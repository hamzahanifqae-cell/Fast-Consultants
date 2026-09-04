<?php

namespace App\Http\Controllers\Api;

use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\SendChatMessageRequest;
use App\Http\Requests\Api\SetChatTypingRequest;
use App\Http\Requests\Api\StartChatRequest;
use App\Models\ChatConversation;
use App\Models\ChatConversationRead;
use App\Models\ChatMessage;
use App\Models\ChatStudentBlock;
use App\Models\User;
use App\Models\UserNotification;
use App\Services\StudentNotificationService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class ChatController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
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
        $user = $request->user();

        $conversations = ChatConversation::query()
            ->with([
                'student:id,name,email',
                'consultant:id,name,email',
                'latestMessage.sender:id,name',
            ])
            ->when(
                $user->isStudent(),
                fn (Builder $query) => $query->where('student_id', $user->id),
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

        $blockKeys = ChatStudentBlock::query()
            ->whereIn('student_id', $conversations->pluck('student_id')->unique()->filter())
            ->get(['student_id', 'department'])
            ->map(fn (ChatStudentBlock $block) => $this->blockKey((int) $block->student_id, $block->department))
            ->flip();

        $payload = $conversations->map(function (ChatConversation $conversation) use ($user, $unreadByConversation, $blockKeys) {
            $conversation->unread_count = (int) ($unreadByConversation[$conversation->id] ?? 0);
            $conversation->is_blocked = $blockKeys->has(
                $this->blockKey($conversation->student_id, $conversation->department)
            );

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
            ],
        );

        if ($request->filled('message')) {
            $this->storeMessage($conversation, $student->id, $request->string('message')->toString());
        }

        $this->markConversationRead($conversation, $student);

        $conversation->load([
            'student:id,name,email',
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

    public function messages(Request $request, ChatConversation $conversation): JsonResponse
    {
        $this->ensureCanAccess($request, $conversation);

        $viewer = $request->user();
        $this->markConversationRead($conversation, $viewer);

        $conversation->load([
            'student:id,name,email',
            'consultant:id,name,email',
            'messages.sender:id,name',
        ]);
        $conversation->unread_count = 0;
        $conversation->is_blocked = $this->isStudentBlocked(
            $conversation->student_id,
            $conversation->department,
        );

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
            $this->ensureStudentNotBlocked($viewer->id, $conversation->department);
        }

        $message = $this->storeMessage(
            $conversation,
            $viewer->id,
            $request->string('body')->toString(),
        );

        $this->setTyping($conversation->id, $viewer->id, false);
        $this->markConversationRead($conversation, $viewer);

        $conversation->load([
            'student:id,name,email',
            'consultant:id,name,email',
            'latestMessage.sender:id,name',
        ]);
        $conversation->unread_count = 0;
        $conversation->is_blocked = $this->isStudentBlocked(
            $conversation->student_id,
            $conversation->department,
        );

        return response()->json([
            'data' => [
                'conversation' => $this->conversationPayload($conversation, $viewer),
                'message' => $this->messagePayload($message, $viewer->id),
            ],
        ], 201);
    }

    public function block(Request $request, ChatConversation $conversation): JsonResponse
    {
        $this->ensureCanAccess($request, $conversation);
        $staff = $request->user();
        abort_unless($staff->isConsultant(), 403);

        ChatStudentBlock::query()->updateOrCreate(
            [
                'student_id' => $conversation->student_id,
                'department' => $conversation->department,
            ],
            [
                'blocked_by' => $staff->id,
                'blocked_at' => now(),
            ],
        );

        $conversation->loadMissing('student');

        if ($conversation->student) {
            $scope = $conversation->department
                ? "chat access to {$conversation->department->label()}"
                : 'chat access';

            $this->notifications->createForUser(
                $conversation->student,
                $staff,
                "Your {$scope} has been blocked by staff. You can still read past messages.",
                'chat_blocked',
                'chat',
                $conversation->id,
            );
        }

        $conversation->load([
            'student:id,name,email',
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
        $staff = $request->user();
        abort_unless($staff->isConsultant(), 403);

        $this->blockQuery($conversation->student_id, $conversation->department)->delete();

        $conversation->loadMissing('student');

        if ($conversation->student) {
            $scope = $conversation->department
                ? "chat access to {$conversation->department->label()}"
                : 'chat access';

            $this->notifications->createForUser(
                $conversation->student,
                $staff,
                "Your {$scope} has been restored. You can send messages again.",
                'chat_unblocked',
                'chat',
                $conversation->id,
            );
        }

        $conversation->load([
            'student:id,name,email',
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
        // Super Admin and Admin see every student ↔ department thread.
        if ($user->isSuperAdmin() || $user->isAdmin()) {
            return $query;
        }

        $departments = collect($user->accessibleDepartments())->map->value->all();

        return $query->where(function (Builder $inner) use ($user, $departments) {
            if ($departments !== []) {
                $inner->whereIn('department', $departments);
            }

            $inner->orWhere(function (Builder $legacy) use ($user) {
                $legacy->whereNull('department')->where('consultant_id', $user->id);
            });
        });
    }

    private function storeMessage(ChatConversation $conversation, int $senderId, string $body): ChatMessage
    {
        $message = $conversation->messages()->create([
            'sender_id' => $senderId,
            'body' => $body,
        ]);

        $conversation->update([
            'last_message_at' => now(),
        ]);

        $message->load('sender:id,name');
        $conversation->loadMissing('student:id,name,email');

        $preview = Str::limit(trim($body), 90);
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
     * @return list<User>
     */
    private function recipientsFor(ChatConversation $conversation, int $senderId): array
    {
        $sender = User::query()->find($senderId);

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
        $isStudentViewer = $viewer->id === $conversation->student_id;
        $other = $isStudentViewer
            ? $conversation->consultant
            : $conversation->student;

        $displayName = $isStudentViewer
            ? ($conversation->department?->label() ?? $other?->name)
            : $other?->name;

        return [
            'id' => $conversation->id,
            'department' => $conversation->department?->value,
            'department_label' => $conversation->department?->label(),
            'other_user' => [
                'id' => $other?->id,
                'name' => $displayName,
                'email' => $other?->email,
            ],
            'last_message' => $conversation->latestMessage
                ? [
                    'id' => $conversation->latestMessage->id,
                    'body' => $conversation->latestMessage->body,
                    'created_at' => $conversation->latestMessage->created_at?->toIso8601String(),
                    'mine' => $conversation->latestMessage->sender_id === $viewer->id,
                ]
                : null,
            'last_message_at' => $conversation->last_message_at?->toIso8601String(),
            'other_user_typing' => $this->isPeerTyping($conversation->id, $viewer->id),
            'unread_count' => (int) ($conversation->unread_count ?? 0),
            'is_blocked' => (bool) (
                $conversation->is_blocked
                ?? $this->isStudentBlocked($conversation->student_id, $conversation->department)
            ),
        ];
    }

    /** Blocks are per department, so a block from one department leaves the others open. */
    private function isStudentBlocked(int $studentId, ?StaffDepartment $department): bool
    {
        return $this->blockQuery($studentId, $department)->exists();
    }

    private function ensureStudentNotBlocked(int $studentId, ?StaffDepartment $department): void
    {
        abort_if(
            $this->isStudentBlocked($studentId, $department),
            403,
            $department
                ? "Your chat access to {$department->label()} has been blocked by staff."
                : 'Your chat access has been blocked by staff.',
        );
    }

    /**
     * @return Builder<ChatStudentBlock>
     */
    private function blockQuery(int $studentId, ?StaffDepartment $department): Builder
    {
        return ChatStudentBlock::query()
            ->where('student_id', $studentId)
            ->when(
                $department,
                fn (Builder $query) => $query->where('department', $department->value),
                fn (Builder $query) => $query->whereNull('department'),
            );
    }

    private function blockKey(int $studentId, ?StaffDepartment $department): string
    {
        return $studentId.'|'.($department?->value ?? '');
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
        ];
    }
}
