<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\BroadcastChatMessageRequest;
use App\Http\Requests\Api\SendChatMessageRequest;
use App\Http\Requests\Api\SendWhatsAppChatMessageRequest;
use App\Http\Requests\Api\SetChatTypingRequest;
use App\Http\Requests\Api\StartChatRequest;
use App\Http\Requests\Api\StartStaffChatRequest;
use App\Models\ChatConversation;
use App\Models\ChatConversationRead;
use App\Models\ChatMessage;
use App\Models\ChatScheduledMessage;
use App\Models\ChatStudentBlock;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\ScheduledChatDispatcher;
use App\Services\StudentNotificationService;
use App\Services\WhatsAppCloudService;
use App\Support\UploadStorage;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChatController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
        private readonly WhatsAppCloudService $whatsapp,
        private readonly ScheduledChatDispatcher $scheduledChat,
    ) {
    }

    public function departments(): JsonResponse
    {
        return response()->json([
            'data' => collect(StaffDepartment::cases())
                ->map(fn (StaffDepartment $department) => [
                    'value' => $department->value,
                    'label' => $department->label(),
                ])
                ->values(),
        ]);
    }

    public function conversations(Request $request): JsonResponse
    {
        $this->scheduledChat->sendDueIfNeeded();

        $user = $request->user();

        $conversations = ChatConversation::query()
            ->with([
                'student:id,name,email',
                'student.studentProfile:id,user_id,phone',
                'consultant:id,name,email',
                'staffLow:id,name,email,staff_department',
                'staffHigh:id,name,email,staff_department',
                'latestMessage.sender:id,name',
            ])
            ->when(
                $user->isStudent(),
                fn (Builder $query) => $query
                    ->where('kind', ChatConversation::KIND_STUDENT_DEPARTMENT)
                    ->where('student_id', $user->id),
                fn (Builder $query) => $this->scopeVisibleToOrganization($query, $user),
            )
            ->orderByDesc('last_message_at')
            ->orderByDesc('id')
            ->get();

        if ($conversations->isEmpty()) {
            return response()->json([
                'data' => [],
                'unread_count' => 0,
            ]);
        }

        $readAtByConversation = ChatConversationRead::query()
            ->where('user_id', $user->id)
            ->whereIn('conversation_id', $conversations->pluck('id'))
            ->pluck('last_read_at', 'conversation_id');

        $neverReadIds = $conversations->pluck('id')
            ->diff($readAtByConversation->keys())
            ->values()
            ->all();

        $unreadByConversation = collect();

        if ($neverReadIds !== [] || $readAtByConversation->isNotEmpty()) {
            $unreadByConversation = ChatMessage::query()
                ->selectRaw('conversation_id, COUNT(*) as aggregate')
                ->whereIn('conversation_id', $conversations->pluck('id'))
                ->where('sender_id', '!=', $user->id)
                ->where(function (Builder $query) use ($readAtByConversation, $neverReadIds) {
                    if ($neverReadIds !== []) {
                        $query->orWhereIn('conversation_id', $neverReadIds);
                    }

                    foreach ($readAtByConversation as $conversationId => $lastReadAt) {
                        $query->orWhere(function (Builder $inner) use ($conversationId, $lastReadAt) {
                            $inner->where('conversation_id', $conversationId)
                                ->where('created_at', '>', $lastReadAt);
                        });
                    }
                })
                ->groupBy('conversation_id')
                ->pluck('aggregate', 'conversation_id');
        }

        $blockedStudentIds = ChatStudentBlock::query()
            ->whereIn(
                'student_id',
                $conversations->pluck('student_id')->unique()->filter()->values()->all(),
            )
            ->pluck('student_id')
            ->flip();

        $payload = $conversations->map(function (ChatConversation $conversation) use ($user, $unreadByConversation, $blockedStudentIds) {
            $conversation->unread_count = (int) ($unreadByConversation[$conversation->id] ?? 0);
            $conversation->is_blocked = $conversation->student_id
                ? $blockedStudentIds->has($conversation->student_id)
                : false;

            return $this->conversationPayload($conversation, $user);
        });

        return response()->json([
            'data' => $payload,
            'unread_count' => $payload->sum(fn (array $item) => (int) ($item['unread_count'] ?? 0)),
        ]);
    }

    public function start(StartChatRequest $request): JsonResponse
    {
        $student = $request->user();

        $department = $request->enum('department', StaffDepartment::class);
        $this->ensureStudentNotBlocked($student->id, $department);

        $conversation = ChatConversation::query()->firstOrCreate(
            [
                'student_id' => $student->id,
                'department' => $department,
                'kind' => ChatConversation::KIND_STUDENT_DEPARTMENT,
            ],
        );

        if ($request->filled('message')) {
            $this->storeMessage($conversation, $student->id, $request->string('message')->toString());
        }

        $this->markConversationRead($conversation, $student);

        $conversation->load([
            'student:id,name,email',
                'student.studentProfile:id,user_id,phone',
            'consultant:id,name,email',
            'latestMessage.sender:id,name',
            'messages.sender:id,name',
        ]);
        $conversation->unread_count = 0;
        $conversation->is_blocked = $this->isStudentBlocked($student->id, $conversation->department);

        return response()->json([
            'data' => [
                'conversation' => $this->conversationPayload($conversation, $student),
                'messages' => $conversation->messages
                    ->map(fn (ChatMessage $message) => $this->messagePayload($message, $student->id))
                    ->values(),
            ],
        ], 201);
    }

    public function staffDirectory(Request $request): JsonResponse
    {
        $viewer = $request->user();
        abort_unless($viewer->isConsultant(), 403);

        $staff = User::query()
            ->where('id', '!=', $viewer->id)
            ->whereHas('roles', function (Builder $roles) {
                $roles->whereIn('name', [
                    Role::SuperAdmin->value,
                    Role::Admin->value,
                    Role::Staff->value,
                    Role::Consultant->value,
                ]);
            })
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'phone', 'staff_department']);

        return response()->json([
            'data' => $staff->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'staff_department' => $user->staff_department?->value,
                'staff_department_label' => $user->staff_department?->label(),
            ])->values(),
        ]);
    }

    public function startStaff(StartStaffChatRequest $request): JsonResponse
    {
        $viewer = $request->user();
        $peerId = (int) $request->integer('peer_user_id');
        $peer = User::query()->findOrFail($peerId);

        abort_unless($peer->isConsultant(), 422, 'You can only message organization staff.');
        abort_unless($viewer->id !== $peer->id, 422, 'You cannot message yourself.');

        [$lowId, $highId] = ChatConversation::orderedStaffPair($viewer->id, $peer->id);

        $conversation = ChatConversation::query()->firstOrCreate(
            [
                'kind' => ChatConversation::KIND_STAFF_DM,
                'staff_low_id' => $lowId,
                'staff_high_id' => $highId,
            ],
            [
                'student_id' => null,
                'department' => null,
                'consultant_id' => null,
            ],
        );

        if ($request->filled('message')) {
            $this->storeMessage($conversation, $viewer->id, $request->string('message')->toString());
        }

        $this->markConversationRead($conversation, $viewer);

        $conversation->load([
            'student:id,name,email',
                'student.studentProfile:id,user_id,phone',
            'consultant:id,name,email',
            'staffLow:id,name,email,staff_department',
            'staffHigh:id,name,email,staff_department',
            'latestMessage.sender:id,name',
            'messages.sender:id,name',
        ]);
        $conversation->unread_count = 0;
        $conversation->is_blocked = false;

        return response()->json([
            'data' => [
                'conversation' => $this->conversationPayload($conversation, $viewer),
                'messages' => $conversation->messages
                    ->map(fn (ChatMessage $message) => $this->messagePayload($message, $viewer->id))
                    ->values(),
            ],
        ], 201);
    }

    public function broadcast(BroadcastChatMessageRequest $request): JsonResponse
    {
        $viewer = $request->user();
        $department = $this->resolveBroadcastDepartment(
            $viewer,
            $request->filled('department') ? $request->string('department')->toString() : null,
        );
        $body = trim($request->string('message')->toString());
        /** @var list<int> $studentIds */
        $studentIds = array_values(array_unique(array_map('intval', $request->input('student_ids', []))));

        $students = User::query()
            ->whereIn('id', $studentIds)
            ->whereHas('roles', fn (Builder $roles) => $roles->where('name', Role::Student->value))
            ->get(['id', 'name', 'email'])
            ->keyBy('id');

        abort_unless($students->count() === count($studentIds), 422, 'One or more selected users are not students.');

        $attachmentMeta = $this->storeUploadedAttachment($request->file('attachment'), $viewer->id);

        if ($request->filled('scheduled_at')) {
            abort_unless($viewer->isConsultant(), 403);

            $scheduled = ChatScheduledMessage::query()->create([
                'sender_id' => $viewer->id,
                'type' => ChatScheduledMessage::TYPE_BROADCAST,
                'conversation_id' => null,
                'body' => $body,
                'attachment_path' => $attachmentMeta['path'] ?? null,
                'attachment_original_name' => $attachmentMeta['original_name'] ?? null,
                'attachment_mime_type' => $attachmentMeta['mime_type'] ?? null,
                'attachment_size' => $attachmentMeta['size'] ?? null,
                'broadcast_student_ids' => $studentIds,
                'broadcast_department' => $department->value,
                'scheduled_at' => Carbon::parse($request->input('scheduled_at')),
                'status' => ChatScheduledMessage::STATUS_PENDING,
            ]);

            return response()->json([
                'data' => [
                    'scheduled' => true,
                    'id' => $scheduled->id,
                    'scheduled_at' => $scheduled->scheduled_at?->toIso8601String(),
                    'sent_count' => 0,
                    'skipped_blocked_count' => 0,
                    'conversation_ids' => [],
                    'department' => $department->value,
                    'department_label' => $department->label(),
                ],
            ], 201);
        }

        $result = $this->deliverBroadcast(
            $viewer->id,
            $studentIds,
            $body,
            $department,
            $attachmentMeta,
        );

        return response()->json([
            'data' => [
                'scheduled' => false,
                ...$result,
                'department' => $department->value,
                'department_label' => $department->label(),
            ],
        ], 201);
    }

    public function broadcastWhatsApp(BroadcastChatMessageRequest $request): JsonResponse
    {
        $viewer = $request->user();
        abort_unless($viewer->isConsultant(), 403);
        abort_if($request->filled('scheduled_at'), 422, 'Scheduled WhatsApp broadcast is not supported. Send now instead.');

        $department = $this->resolveBroadcastDepartment(
            $viewer,
            $request->filled('department') ? $request->string('department')->toString() : null,
        );
        $body = trim($request->string('message')->toString());
        /** @var list<int> $studentIds */
        $studentIds = array_values(array_unique(array_map('intval', $request->input('student_ids', []))));

        $students = User::query()
            ->whereIn('id', $studentIds)
            ->whereHas('roles', fn (Builder $roles) => $roles->where('name', Role::Student->value))
            ->with('studentProfile:id,user_id,phone')
            ->get(['id', 'name', 'email'])
            ->keyBy('id');

        abort_unless($students->count() === count($studentIds), 422, 'One or more selected users are not students.');

        $attachmentMeta = $this->storeUploadedAttachment($request->file('attachment'), $viewer->id);
        abort_if($body === '' && $attachmentMeta === null, 422, 'Enter a message or attach a file.');

        $mediaContents = null;
        $mediaMime = null;
        $mediaFilename = null;
        if ($attachmentMeta !== null) {
            $mediaContents = UploadStorage::disk()->get($attachmentMeta['path']);
            if ($mediaContents === null || $mediaContents === '') {
                return response()->json([
                    'message' => 'Could not read the attachment for WhatsApp.',
                ], 422);
            }
            $mediaMime = $attachmentMeta['mime_type'] ?: null;
            $mediaFilename = $attachmentMeta['original_name'] ?: 'attachment';
        }

        $whatsappSent = 0;
        $whatsappFailed = 0;
        $failures = [];

        foreach ($studentIds as $studentId) {
            $student = $students->get($studentId);
            $phone = $student?->studentProfile?->phone;
            try {
                $this->whatsapp->sendMessage(
                    (string) $phone,
                    $body,
                    $mediaContents,
                    $mediaMime,
                    $mediaFilename,
                );
                $whatsappSent++;
            } catch (RuntimeException $exception) {
                $whatsappFailed++;
                $failures[] = [
                    'student_id' => $studentId,
                    'student_name' => $student?->name,
                    'message' => $exception->getMessage(),
                ];
            }
        }

        abort_if(
            $whatsappSent === 0,
            422,
            $failures[0]['message'] ?? 'Could not send WhatsApp to any selected students.',
        );

        // Also deliver in-app for students who received WhatsApp (and still deliver to all for chat parity).
        $result = $this->deliverBroadcast(
            $viewer->id,
            $studentIds,
            $body,
            $department,
            $attachmentMeta,
        );

        return response()->json([
            'data' => [
                'scheduled' => false,
                ...$result,
                'department' => $department->value,
                'department_label' => $department->label(),
                'whatsapp' => [
                    'sent_count' => $whatsappSent,
                    'failed_count' => $whatsappFailed,
                    'failures' => $failures,
                ],
            ],
        ], 201);
    }

    public function messages(Request $request, ChatConversation $conversation): JsonResponse
    {
        $this->scheduledChat->sendDueIfNeeded();

        $this->ensureCanAccess($request, $conversation);

        $viewer = $request->user();
        $this->markConversationRead($conversation, $viewer);

        $conversation->load([
            'student:id,name,email',
                'student.studentProfile:id,user_id,phone',
            'consultant:id,name,email',
            'staffLow:id,name,email,staff_department',
            'staffHigh:id,name,email,staff_department',
            'messages.sender:id,name',
        ]);
        $conversation->unread_count = 0;
        $conversation->is_blocked = $conversation->student_id
            ? $this->isStudentBlocked($conversation->student_id, $conversation->department)
            : false;

        return response()->json([
            'data' => [
                'conversation' => $this->conversationPayload($conversation, $viewer),
                'messages' => $conversation->messages
                    ->map(fn (ChatMessage $message) => $this->messagePayload($message, $viewer->id))
                    ->values(),
                'peer_typing' => $this->isPeerTyping($conversation->id, $viewer->id),
            ],
        ]);
    }

    public function typing(SetChatTypingRequest $request, ChatConversation $conversation): JsonResponse
    {
        $this->ensureCanAccess($request, $conversation);

        $viewer = $request->user();
        if ($viewer->isStudent() && $this->isStudentBlocked($viewer->id, $conversation->department)) {
            return response()->json([
                'data' => [
                    'typing' => false,
                ],
            ]);
        }

        $this->setTyping($conversation->id, $viewer->id, $request->boolean('typing'));

        return response()->json([
            'data' => [
                'typing' => $request->boolean('typing'),
            ],
        ]);
    }

    public function send(SendChatMessageRequest $request, ChatConversation $conversation): JsonResponse
    {
        $this->ensureCanAccess($request, $conversation);

        $viewer = $request->user();
        if ($viewer->isStudent()) {
            abort_unless($conversation->kind === ChatConversation::KIND_STUDENT_DEPARTMENT, 403);
            $this->ensureStudentNotBlocked($viewer->id, $conversation->department);
            abort_if($request->filled('scheduled_at'), 422, 'Only staff can schedule messages.');
        }

        $body = trim($request->string('body')->toString());
        $attachmentMeta = $this->storeUploadedAttachment($request->file('attachment'), $viewer->id);

        if ($request->filled('scheduled_at')) {
            abort_unless($viewer->isConsultant(), 403);

            $scheduled = ChatScheduledMessage::query()->create([
                'sender_id' => $viewer->id,
                'type' => ChatScheduledMessage::TYPE_CONVERSATION,
                'conversation_id' => $conversation->id,
                'body' => $body,
                'attachment_path' => $attachmentMeta['path'] ?? null,
                'attachment_original_name' => $attachmentMeta['original_name'] ?? null,
                'attachment_mime_type' => $attachmentMeta['mime_type'] ?? null,
                'attachment_size' => $attachmentMeta['size'] ?? null,
                'scheduled_at' => Carbon::parse($request->input('scheduled_at')),
                'status' => ChatScheduledMessage::STATUS_PENDING,
            ]);

            return response()->json([
                'data' => [
                    'scheduled' => true,
                    'id' => $scheduled->id,
                    'scheduled_at' => $scheduled->scheduled_at?->toIso8601String(),
                    'conversation' => $this->conversationPayload(
                        $conversation->load([
                            'student:id,name,email',
                'student.studentProfile:id,user_id,phone',
                            'consultant:id,name,email',
                            'staffLow:id,name,email,staff_department',
                            'staffHigh:id,name,email,staff_department',
                            'latestMessage.sender:id,name',
                        ]),
                        $viewer,
                    ),
                ],
            ], 201);
        }

        $message = $this->storeMessage(
            $conversation,
            $viewer->id,
            $body,
            $attachmentMeta,
        );

        $this->setTyping($conversation->id, $viewer->id, false);
        $this->markConversationRead($conversation, $viewer);

        $conversation->load([
            'student:id,name,email',
                'student.studentProfile:id,user_id,phone',
            'consultant:id,name,email',
            'staffLow:id,name,email,staff_department',
            'staffHigh:id,name,email,staff_department',
            'latestMessage.sender:id,name',
        ]);
        $conversation->unread_count = 0;
        $conversation->is_blocked = $conversation->student_id
            ? $this->isStudentBlocked($conversation->student_id, $conversation->department)
            : false;

        return response()->json([
            'data' => [
                'scheduled' => false,
                'conversation' => $this->conversationPayload($conversation, $viewer),
                'message' => $this->messagePayload($message, $viewer->id),
            ],
        ], 201);
    }

    public function sendWhatsApp(SendWhatsAppChatMessageRequest $request, ChatConversation $conversation): JsonResponse
    {
        $viewer = $request->user();
        abort_unless($viewer->isConsultant(), 403, 'Only staff can send WhatsApp messages.');
        $this->ensureCanAccess($request, $conversation);

        $body = trim($request->string('body')->toString());
        $attachmentMeta = $this->storeUploadedAttachment($request->file('attachment'), $viewer->id);

        abort_if($body === '' && $attachmentMeta === null, 422, 'Enter a message or attach a file for WhatsApp.');

        $phone = null;
        if ($conversation->kind === ChatConversation::KIND_STAFF_DM) {
            $conversation->loadMissing(['staffLow:id,name,email,phone,staff_department', 'staffHigh:id,name,email,phone,staff_department']);
            $peer = $conversation->staffPeerFor($viewer);
            $phone = $peer?->phone;
            abort_if(
                ! filled($phone),
                422,
                'This staff member has no phone number. Add it in Organization team settings.',
            );
        } else {
            abort_unless(
                $conversation->kind === ChatConversation::KIND_STUDENT_DEPARTMENT,
                422,
                'WhatsApp is only available for student and staff chats.',
            );
            $conversation->loadMissing([
                'student:id,name,email',
                'student.studentProfile:id,user_id,phone',
            ]);
            $phone = $conversation->student?->studentProfile?->phone;
        }

        $mediaContents = null;
        $mediaMime = null;
        $mediaFilename = null;

        if ($attachmentMeta !== null) {
            $mediaContents = UploadStorage::disk()->get($attachmentMeta['path']);
            if ($mediaContents === null || $mediaContents === '') {
                return response()->json([
                    'message' => 'Could not read the attachment for WhatsApp.',
                ], 422);
            }
            $mediaMime = $attachmentMeta['mime_type'] ?: null;
            $mediaFilename = $attachmentMeta['original_name'] ?: 'attachment';
        }

        try {
            $whatsappResult = $this->whatsapp->sendMessage(
                (string) $phone,
                $body,
                $mediaContents,
                $mediaMime,
                $mediaFilename,
            );
        } catch (RuntimeException $exception) {
            return response()->json([
                'message' => $exception->getMessage(),
            ], 422);
        }

        $message = $this->storeMessage($conversation, $viewer->id, $body, $attachmentMeta);
        $this->setTyping($conversation->id, $viewer->id, false);
        $this->markConversationRead($conversation, $viewer);

        $conversation->load([
            'student:id,name,email',
            'student.studentProfile:id,user_id,phone',
            'consultant:id,name,email',
            'staffLow:id,name,email,staff_department',
            'staffHigh:id,name,email,staff_department',
            'latestMessage.sender:id,name',
        ]);
        $conversation->unread_count = 0;
        $conversation->is_blocked = $conversation->student_id
            ? $this->isStudentBlocked($conversation->student_id, $conversation->department)
            : false;

        return response()->json([
            'data' => [
                'conversation' => $this->conversationPayload($conversation, $viewer),
                'message' => $this->messagePayload($message, $viewer->id),
                'whatsapp' => [
                    'sent' => true,
                    'mode' => $whatsappResult['mode'],
                    'provider_message_id' => $whatsappResult['provider_message_id'],
                ],
            ],
        ], 201);
    }

    public function block(Request $request, ChatConversation $conversation): JsonResponse
    {
        $this->ensureCanAccess($request, $conversation);
        abort_unless($conversation->kind === ChatConversation::KIND_STUDENT_DEPARTMENT, 422, 'Only student chats can be blocked.');
        $staff = $request->user();
        abort_unless($staff->isConsultant(), 403);

        ChatStudentBlock::query()->updateOrCreate(
            [
                'student_id' => $conversation->student_id,
            ],
            [
                'department' => null,
                'blocked_by' => $staff->id,
                'blocked_at' => now(),
            ],
        );

        $conversation->loadMissing('student');

        if ($conversation->student) {
            $this->notifications->createForUser(
                $conversation->student,
                $staff,
                'Your chat access has been blocked by staff. You can still read past messages, but you cannot message any department until staff unblocks you.',
                'chat_blocked',
                'chat',
                $conversation->id,
            );
        }

        $conversation->load([
            'student:id,name,email',
                'student.studentProfile:id,user_id,phone',
            'consultant:id,name,email',
            'latestMessage.sender:id,name',
        ]);
        $conversation->is_blocked = true;

        return response()->json([
            'data' => [
                'conversation' => $this->conversationPayload($conversation, $staff),
            ],
        ]);
    }

    public function unblock(Request $request, ChatConversation $conversation): JsonResponse
    {
        $this->ensureCanAccess($request, $conversation);
        abort_unless($conversation->kind === ChatConversation::KIND_STUDENT_DEPARTMENT, 422, 'Only student chats can be unblocked.');
        $staff = $request->user();
        abort_unless($staff->isConsultant(), 403);

        ChatStudentBlock::query()->where('student_id', $conversation->student_id)->delete();

        $conversation->loadMissing('student');

        if ($conversation->student) {
            $this->notifications->createForUser(
                $conversation->student,
                $staff,
                'Your chat access has been restored. You can send messages to departments again.',
                'chat_unblocked',
                'chat',
                $conversation->id,
            );
        }

        $conversation->load([
            'student:id,name,email',
                'student.studentProfile:id,user_id,phone',
            'consultant:id,name,email',
            'latestMessage.sender:id,name',
        ]);
        $conversation->is_blocked = false;

        return response()->json([
            'data' => [
                'conversation' => $this->conversationPayload($conversation, $staff),
            ],
        ]);
    }

    /**
     * @param  Builder<ChatConversation>  $query
     * @return Builder<ChatConversation>
     */
    private function scopeVisibleToOrganization(Builder $query, User $user): Builder
    {
        return $query->where(function (Builder $outer) use ($user) {
            $outer->where(function (Builder $studentThreads) use ($user) {
                $studentThreads->where('kind', ChatConversation::KIND_STUDENT_DEPARTMENT);

                if ($user->isSuperAdmin() || $user->isAdmin()) {
                    return;
                }

                $departments = collect($user->accessibleDepartments())->map->value->all();

                $studentThreads->where(function (Builder $inner) use ($user, $departments) {
                    if ($departments !== []) {
                        $inner->whereIn('department', $departments);
                    }

                    $inner->orWhere(function (Builder $legacy) use ($user) {
                        $legacy->whereNull('department')->where('consultant_id', $user->id);
                    });
                });
            })->orWhere(function (Builder $staffDms) use ($user) {
                $staffDms->where('kind', ChatConversation::KIND_STAFF_DM)
                    ->where(function (Builder $pair) use ($user) {
                        $pair->where('staff_low_id', $user->id)
                            ->orWhere('staff_high_id', $user->id);
                    });
            });
        });
    }

    /**
     * @param  list<int>  $studentIds
     * @param  array{path: string, original_name: string, mime_type: string|null, size: int|null}|null  $attachmentMeta
     * @return array{sent_count: int, skipped_blocked_count: int, conversation_ids: list<int>}
     */
    public function deliverBroadcast(
        int $senderId,
        array $studentIds,
        string $body,
        StaffDepartment $department,
        ?array $attachmentMeta,
        bool $deleteSourceAttachment = true,
    ): array {
        $blockedIds = ChatStudentBlock::query()
            ->whereIn('student_id', $studentIds)
            ->pluck('student_id')
            ->flip();

        $conversationIds = [];
        $sentCount = 0;
        $skippedBlockedCount = 0;

        foreach ($studentIds as $studentId) {
            if ($blockedIds->has($studentId)) {
                $skippedBlockedCount++;
                continue;
            }

            $conversation = ChatConversation::query()->firstOrCreate(
                [
                    'student_id' => $studentId,
                    'department' => $department,
                    'kind' => ChatConversation::KIND_STUDENT_DEPARTMENT,
                ],
            );

            $messageAttachment = $attachmentMeta
                ? $this->duplicateAttachmentForMessage($attachmentMeta, $senderId)
                : null;

            $this->storeMessage($conversation, $senderId, $body, $messageAttachment);
            $conversationIds[] = $conversation->id;
            $sentCount++;
        }

        if ($deleteSourceAttachment && $attachmentMeta !== null) {
            UploadStorage::disk()->delete($attachmentMeta['path']);
        }

        return [
            'sent_count' => $sentCount,
            'skipped_blocked_count' => $skippedBlockedCount,
            'conversation_ids' => $conversationIds,
        ];
    }

    public function dispatchScheduledMessage(ChatScheduledMessage $scheduled): void
    {
        if ($scheduled->status !== ChatScheduledMessage::STATUS_PENDING) {
            return;
        }

        $sender = User::query()->find($scheduled->sender_id);
        $conversationId = null;
        $notice = 'Your scheduled message was sent.';

        if ($scheduled->type === ChatScheduledMessage::TYPE_CONVERSATION) {
            $conversation = $scheduled->conversation;
            abort_unless($conversation instanceof ChatConversation, 404, 'Conversation missing for scheduled message.');

            $attachment = $scheduled->attachmentMeta();
            $this->storeMessage(
                $conversation,
                $scheduled->sender_id,
                trim((string) $scheduled->body),
                $attachment,
            );

            $conversationId = $conversation->id;
            $conversation->loadMissing([
                'student:id,name',
                'staffLow:id,name',
                'staffHigh:id,name',
            ]);
            if ($conversation->isStaffDm() && $sender) {
                $recipientName = $conversation->staffPeerFor($sender)?->name ?? 'teammate';
            } else {
                $recipientName = $conversation->student?->name ?? 'student';
            }
            $notice = "Your scheduled message to {$recipientName} was sent.";
        } elseif ($scheduled->type === ChatScheduledMessage::TYPE_BROADCAST) {
            $department = $scheduled->broadcast_department;
            abort_unless($department instanceof StaffDepartment, 422, 'Broadcast department missing.');

            /** @var list<int> $studentIds */
            $studentIds = array_values(array_map('intval', $scheduled->broadcast_student_ids ?? []));
            abort_unless($studentIds !== [], 422, 'Broadcast recipients missing.');

            $result = $this->deliverBroadcast(
                $scheduled->sender_id,
                $studentIds,
                trim((string) $scheduled->body),
                $department,
                $scheduled->attachmentMeta(),
                deleteSourceAttachment: false,
            );
            $notice = "Your scheduled broadcast was sent ({$result['sent_count']} recipient"
                .($result['sent_count'] === 1 ? '' : 's').').';
        } else {
            throw new \RuntimeException('Unknown scheduled message type.');
        }

        $scheduled->update([
            'status' => ChatScheduledMessage::STATUS_SENT,
            'sent_at' => now(),
            'error_message' => null,
        ]);

        if ($sender) {
            $this->notifications->createForUser(
                $sender,
                $sender,
                $notice,
                'chat_scheduled_sent',
                'chat',
                $conversationId,
            );
        }
    }

    private function storeMessage(
        ChatConversation $conversation,
        int $senderId,
        string $body,
        ?array $attachment = null,
    ): ChatMessage {
        $message = $conversation->messages()->create([
            'sender_id' => $senderId,
            'body' => $body,
            'attachment_path' => $attachment['path'] ?? null,
            'attachment_original_name' => $attachment['original_name'] ?? null,
            'attachment_mime_type' => $attachment['mime_type'] ?? null,
            'attachment_size' => $attachment['size'] ?? null,
        ]);

        $conversation->update([
            'last_message_at' => now(),
        ]);

        $message->load('sender:id,name');
        $conversation->loadMissing(['student:id,name,email', 'student.studentProfile:id,user_id,phone']);

        $preview = $this->messagePreviewText($message);
        $preview = Str::limit($preview, 90);
        $sender = $message->sender;

        if (! $sender) {
            return $message;
        }

        foreach ($this->recipientsFor($conversation, $senderId) as $recipient) {
            $this->notifications->createForUser(
                $recipient,
                $sender,
                "New message from {$sender->name}: {$preview}",
                'chat_message',
                'chat',
                $conversation->id,
            );
        }

        return $message;
    }

    /**
     * @return array{path: string, original_name: string, mime_type: string|null, size: int|null}|null
     */
    private function storeUploadedAttachment(?\Illuminate\Http\UploadedFile $file, int $senderId): ?array
    {
        if (! $file) {
            return null;
        }

        $path = $file->store("chat-attachments/{$senderId}", UploadStorage::diskName());

        return [
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getClientMimeType() ?: $file->getMimeType(),
            'size' => $file->getSize() ?: null,
        ];
    }

    /**
     * @param  array{path: string, original_name: string, mime_type: string|null, size: int|null}  $attachment
     * @return array{path: string, original_name: string, mime_type: string|null, size: int|null}
     */
    private function duplicateAttachmentForMessage(array $attachment, int $senderId): array
    {
        $extension = pathinfo($attachment['path'], PATHINFO_EXTENSION);
        $newPath = 'chat-attachments/'.$senderId.'/'.Str::uuid().($extension !== '' ? '.'.$extension : '');
        UploadStorage::disk()->copy($attachment['path'], $newPath);

        return [
            ...$attachment,
            'path' => $newPath,
        ];
    }

    private function messagePreviewText(ChatMessage $message): string
    {
        $body = trim((string) $message->body);
        if ($body !== '') {
            return $body;
        }

        if ($message->hasAttachment()) {
            return 'Attachment: '.($message->attachment_original_name ?: 'file');
        }

        return 'New message';
    }

    /**
     * @return array<string, mixed>|null
     */
    private function lastMessageSummary(?ChatMessage $message, int $viewerId): ?array
    {
        if (! $message) {
            return null;
        }

        return [
            'id' => $message->id,
            'body' => $this->messagePreviewText($message),
            'has_attachment' => $message->hasAttachment(),
            'created_at' => $message->created_at?->toIso8601String(),
            'mine' => $message->sender_id === $viewerId,
        ];
    }

    public function downloadAttachment(Request $request, ChatMessage $message): StreamedResponse
    {
        $message->loadMissing('conversation');
        abort_unless($message->conversation instanceof ChatConversation, 404);
        abort_unless($message->hasAttachment(), 404);

        $this->ensureCanAccess($request, $message->conversation);

        $disk = UploadStorage::disk();
        abort_unless($disk->exists($message->attachment_path), 404);

        return $disk->download(
            $message->attachment_path,
            $message->attachment_original_name ?: 'attachment',
            [
                'Content-Type' => $message->attachment_mime_type ?: 'application/octet-stream',
            ],
        );
    }

    /**
     * @return list<User>
     */
    private function recipientsFor(ChatConversation $conversation, int $senderId): array
    {
        $sender = User::query()->find($senderId);

        if ($conversation->isStaffDm()) {
            $peerId = $conversation->staff_low_id === $senderId
                ? $conversation->staff_high_id
                : $conversation->staff_low_id;

            if (! $peerId || $peerId === $senderId) {
                return [];
            }

            $peer = User::query()->find($peerId);

            return $peer ? [$peer] : [];
        }

        if ($sender?->isStudent()) {
            if ($conversation->department) {
                return User::query()
                    ->where('id', '!=', $senderId)
                    ->whereHas('roles', function (Builder $roles) {
                        $roles->whereIn('name', [
                            Role::SuperAdmin->value,
                            Role::Admin->value,
                            Role::Staff->value,
                            Role::Consultant->value,
                        ]);
                    })
                    ->get()
                    ->filter(function (User $user) use ($conversation) {
                        if ($user->isSuperAdmin() || $user->isAdmin()) {
                            return true;
                        }

                        return $conversation->department
                            && $user->canAccessDepartment($conversation->department);
                    })
                    ->values()
                    ->all();
            }

            if ($conversation->consultant_id) {
                $consultant = User::query()->find($conversation->consultant_id);

                return $consultant ? [$consultant] : [];
            }

            return [];
        }

        $student = $conversation->student;

        return $student && $student->id !== $senderId ? [$student] : [];
    }

    private function ensureCanAccess(Request $request, ChatConversation $conversation): void
    {
        $user = $request->user();

        if ($conversation->isStaffDm()) {
            abort_unless($user->isConsultant(), 403);
            abort_unless($conversation->includesStaff($user->id), 403);

            return;
        }

        if ($user->isStudent()) {
            abort_unless($conversation->student_id === $user->id, 403);

            return;
        }

        abort_unless($user->isConsultant(), 403);

        if ($user->isSuperAdmin() || $user->isAdmin()) {
            return;
        }

        if ($conversation->department) {
            abort_unless($user->canAccessDepartment($conversation->department), 403);

            return;
        }

        abort_unless($conversation->consultant_id === $user->id, 403);
    }

    private function markConversationRead(ChatConversation $conversation, User $user): void
    {
        $latestMessageAt = $conversation->messages()->max('created_at');
        $readAt = now();

        if ($latestMessageAt !== null) {
            $latest = \Illuminate\Support\Carbon::parse($latestMessageAt);
            // Keep last_read_at at/after every existing message so second-precision
            // comparisons never leave opened threads looking unread.
            if ($latest->greaterThanOrEqualTo($readAt)) {
                $readAt = $latest->copy()->addSecond();
            }
        }

        ChatConversationRead::query()->updateOrCreate(
            [
                'conversation_id' => $conversation->id,
                'user_id' => $user->id,
            ],
            [
                'last_read_at' => $readAt,
            ],
        );

        UserNotification::query()
            ->where('user_id', $user->id)
            ->whereNull('read_at')
            ->where('type', 'chat_message')
            ->where(function (Builder $query) use ($conversation) {
                $query->where('conversation_id', $conversation->id);

                // Older chat alerts were stored without conversation_id.
                if ($conversation->department === null) {
                    $query->orWhere(function (Builder $legacy) {
                        $legacy->where('type', 'chat_message')
                            ->whereNull('conversation_id');
                    });
                }
            })
            ->update(['read_at' => now()]);
    }

    /**
     * @return array<string, mixed>
     */
    private function conversationPayload(ChatConversation $conversation, User $viewer): array
    {
        if ($conversation->isStaffDm()) {
            $other = $conversation->staffPeerFor($viewer);

            return [
                'id' => $conversation->id,
                'kind' => ChatConversation::KIND_STAFF_DM,
                'department' => null,
                'department_label' => null,
                'other_user' => [
                    'id' => $other?->id,
                    'name' => $other?->name,
                    'email' => $other?->email,
                    'phone' => $other?->phone,
                    'staff_department' => $other?->staff_department?->value,
                    'staff_department_label' => $other?->staff_department?->label(),
                ],
                'last_message' => $this->lastMessageSummary($conversation->latestMessage, $viewer->id),
                'last_message_at' => $conversation->last_message_at?->toIso8601String(),
                'other_user_typing' => $this->isPeerTyping($conversation->id, $viewer->id),
                'unread_count' => (int) ($conversation->unread_count ?? 0),
                'is_blocked' => false,
            ];
        }

        $isStudentViewer = $viewer->id === $conversation->student_id;
        $other = $isStudentViewer
            ? $conversation->consultant
            : $conversation->student;

        $displayName = $isStudentViewer
            ? ($conversation->department?->label() ?? $other?->name)
            : $other?->name;

        return [
            'id' => $conversation->id,
            'kind' => ChatConversation::KIND_STUDENT_DEPARTMENT,
            'department' => $conversation->department?->value,
            'department_label' => $conversation->department?->label(),
            'other_user' => [
                'id' => $other?->id,
                'name' => $displayName,
                'email' => $other?->email,
                'phone' => $isStudentViewer ? null : ($other?->studentProfile?->phone),
            ],
            'last_message' => $this->lastMessageSummary($conversation->latestMessage, $viewer->id),
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'other_user_typing' => $this->isPeerTyping($conversation->id, $viewer->id),
            'unread_count' => (int) ($conversation->unread_count ?? 0),
            'is_blocked' => (bool) (
                $conversation->is_blocked
                ?? ($conversation->student_id
                    ? $this->isStudentBlocked($conversation->student_id)
                    : false)
            ),
        ];
    }

    public function blocks(Request $request): JsonResponse
    {
        $staff = $request->user();
        abort_unless($staff->isConsultant(), 403);

        $blocks = ChatStudentBlock::query()
            ->with([
                'student:id,name,email',
                'student.studentProfile:id,user_id,phone',
                'blockedBy:id,name,email',
            ])
            ->orderByDesc('blocked_at')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $blocks->map(fn (ChatStudentBlock $block) => [
                'student_id' => $block->student_id,
                'student' => [
                    'id' => $block->student?->id,
                    'name' => $block->student?->name,
                    'email' => $block->student?->email,
                ],
                'blocked_by' => $block->blockedBy
                    ? [
                        'id' => $block->blockedBy->id,
                        'name' => $block->blockedBy->name,
                        'email' => $block->blockedBy->email,
                    ]
                    : null,
                'blocked_at' => $block->blocked_at?->toIso8601String(),
            ]),
        ]);
    }

    public function unblockStudent(Request $request, User $student): JsonResponse
    {
        $staff = $request->user();
        abort_unless($staff->isConsultant(), 403);
        abort_unless($student->isStudent(), 404);

        $existed = ChatStudentBlock::query()->where('student_id', $student->id)->exists();
        ChatStudentBlock::query()->where('student_id', $student->id)->delete();

        if ($existed) {
            $conversation = ChatConversation::query()
                ->where('student_id', $student->id)
                ->orderByDesc('last_message_at')
                ->orderByDesc('id')
                ->first();

            $this->notifications->createForUser(
                $student,
                $staff,
                'Your chat access has been restored. You can send messages to departments again.',
                'chat_unblocked',
                'chat',
                $conversation?->id,
            );
        }

        return response()->json([
            'data' => [
                'student_id' => $student->id,
                'unblocked' => true,
            ],
        ]);
    }

    /** A block from any staff applies to every department for that student. */
    private function isStudentBlocked(int $studentId, ?StaffDepartment $department = null): bool
    {
        return ChatStudentBlock::query()->where('student_id', $studentId)->exists();
    }

    private function resolveBroadcastDepartment(User $viewer, ?string $departmentValue): StaffDepartment
    {
        $accessible = $viewer->accessibleDepartments();
        $needsExplicitDepartment = $viewer->isSuperAdmin()
            || $viewer->isAdmin()
            || count($accessible) > 1;

        if ($needsExplicitDepartment) {
            abort_unless(
                filled($departmentValue),
                422,
                'Department is required for broadcast.',
            );

            $department = StaffDepartment::tryFrom((string) $departmentValue);
            abort_unless($department instanceof StaffDepartment, 422, 'Invalid department.');
            abort_unless($viewer->canWorkInDepartment($department), 403);

            return $department;
        }

        if ($viewer->staff_department instanceof StaffDepartment) {
            return $viewer->staff_department;
        }

        if (count($accessible) === 1) {
            return $accessible[0];
        }

        abort(422, 'No department assigned for broadcast.');
    }

    private function ensureStudentNotBlocked(int $studentId, ?StaffDepartment $department = null): void
    {
        abort_if(
            $this->isStudentBlocked($studentId),
            403,
            'Your chat access has been blocked by staff.',
        );
    }

    private function setTyping(int $conversationId, int $userId, bool $typing): void
    {
        $key = $this->typingMapKey($conversationId);
        /** @var array<string, int> $map */
        $map = Cache::get($key, []);

        if ($typing) {
            $map[(string) $userId] = now()->timestamp;
        } else {
            unset($map[(string) $userId]);
        }

        Cache::put($key, $map, now()->addSeconds(20));
    }

    private function isPeerTyping(int $conversationId, int $viewerId): bool
    {
        /** @var array<array-key, mixed> $map */
        $map = Cache::get($this->typingMapKey($conversationId), []);
        if (! is_array($map)) {
            return false;
        }

        $cutoff = now()->subSeconds(8)->timestamp;

        foreach ($map as $userId => $timestamp) {
            if ((int) $userId !== $viewerId && (int) $timestamp >= $cutoff) {
                return true;
            }
        }

        return false;
    }

    private function typingMapKey(int $conversationId): string
    {
        return "chat:typing:{$conversationId}";
    }

    /**
     * @return array<string, mixed>
     */
    private function messagePayload(ChatMessage $message, int $viewerId): array
    {
        return [
            'id' => $message->id,
            'body' => $message->body,
            'mine' => $message->sender_id === $viewerId,
            'sender' => [
                'id' => $message->sender->id,
                'name' => $message->sender->name,
            ],
            'created_at' => $message->created_at?->toIso8601String(),
            'attachment' => $message->hasAttachment()
                ? [
                    'name' => $message->attachment_original_name,
                    'mime_type' => $message->attachment_mime_type,
                    'size' => $message->attachment_size,
                    'download_path' => "/chat/messages/{$message->id}/attachment",
                ]
                : null,
        ];
    }
}
