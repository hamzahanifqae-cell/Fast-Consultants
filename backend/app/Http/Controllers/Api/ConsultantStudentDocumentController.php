<?php

namespace App\Http\Controllers\Api;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreUrgentDocumentRequest;
use App\Http\Requests\Api\UpdateStudentDocumentStatusRequest;
use App\Http\Resources\StudentDocumentResource;
use App\Http\Resources\UrgentDocumentRequestResource;
use App\Models\StudentDocument;
use App\Models\UrgentDocumentRequest;
use App\Models\User;
use App\Services\DepartmentHandoffService;
use App\Services\StudentApplicationService;
use App\Services\StudentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use App\Support\UploadStorage;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConsultantStudentDocumentController extends Controller
{
    public function __construct(
        private readonly StudentApplicationService $applications,
        private readonly StudentNotificationService $notifications,
        private readonly DepartmentHandoffService $handoffs,
    ) {
    }

    public function index(Request $request): AnonymousResourceCollection
    {
        $this->assertCanAccessDocuments($request);

        $documents = StudentDocument::query()
            ->with('user:id,name,email')
            ->when(
                $request->filled('status'),
                fn ($query) => $query->where('status', $request->string('status')->toString()),
            )
            ->when(
                $request->filled('student_id'),
                fn ($query) => $query->where('user_id', $request->integer('student_id')),
            )
            ->latest()
            ->get();

        return StudentDocumentResource::collection($documents);
    }

    public function urgentIndex(Request $request): AnonymousResourceCollection
    {
        $this->assertCanAccessDocuments($request);

        $requests = UrgentDocumentRequest::query()
            ->with('requester:id,name,email')
            ->when(
                $request->filled('student_id'),
                fn ($query) => $query->where('student_id', $request->integer('student_id')),
            )
            ->when(
                $request->boolean('open_only', true),
                fn ($query) => $query->whereNull('resolved_at'),
            )
            ->latest()
            ->get();

        return UrgentDocumentRequestResource::collection($requests);
    }

    public function storeUrgent(StoreUrgentDocumentRequest $request): JsonResponse
    {
        $this->assertCanManageDocuments($request);

        $student = User::query()->findOrFail($request->integer('student_id'));
        abort_unless($student->isStudent(), 404);

        $types = collect($request->input('document_types', []))
            ->map(fn ($type) => DocumentType::from((string) $type))
            ->unique(fn (DocumentType $type) => $type->value)
            ->values();
        $note = $request->filled('note') ? $request->string('note')->toString() : null;
        $rejectionReason = 'Urgent update requested by staff'
            .($note ? ': '.$note : '. Please upload an updated file.');

        $created = DB::transaction(function () use ($types, $student, $request, $note, $rejectionReason) {
            $created = [];

            foreach ($types as $type) {
                $existingOpen = UrgentDocumentRequest::query()
                    ->where('student_id', $student->id)
                    ->where('document_type', $type)
                    ->whereNull('resolved_at')
                    ->first();

                if ($existingOpen) {
                    if ($note !== null) {
                        $existingOpen->update(['note' => $note]);
                    }
                    $created[] = $existingOpen->fresh(['requester:id,name,email']);
                    continue;
                }

                $urgent = UrgentDocumentRequest::query()->create([
                    'student_id' => $student->id,
                    'document_type' => $type,
                    'note' => $note,
                    'requested_by' => $request->user()->id,
                ]);

                // Send approved files back so the student can re-upload.
                StudentDocument::query()
                    ->where('user_id', $student->id)
                    ->where('type', $type)
                    ->where('status', DocumentStatus::Approved)
                    ->each(function (StudentDocument $document) use ($request, $rejectionReason) {
                        $document->update([
                            'status' => DocumentStatus::Rejected,
                            'reviewed_by' => $request->user()->id,
                            'reviewed_at' => now(),
                            'rejection_reason' => $rejectionReason,
                        ]);
                    });

                $created[] = $urgent->load('requester:id,name,email');
            }

            return $created;
        });

        $labels = collect($created)
            ->map(fn (UrgentDocumentRequest $item) => $item->document_type->label())
            ->unique()
            ->values();

        $this->applications->forStudent($student);
        $this->handoffs->syncDocuments($student, $request->user());

        $this->notifications->createForStudent(
            $student,
            $request->user(),
            $labels->count() === 1
                ? 'Urgent document requested: '.$labels->first().'. Open Documents to upload it.'
                : 'Urgent documents requested: '.$labels->join(', ').'. Open Documents to upload them.',
            'urgent_documents_requested',
            '/student-documents',
        );

        return UrgentDocumentRequestResource::collection(collect($created))
            ->response()
            ->setStatusCode(201);
    }

    public function resolveUrgent(Request $request, UrgentDocumentRequest $urgentDocumentRequest): UrgentDocumentRequestResource
    {
        $this->assertCanManageDocuments($request);

        if ($urgentDocumentRequest->resolved_at === null) {
            $urgentDocumentRequest->update(['resolved_at' => now()]);
        }

        $student = $urgentDocumentRequest->student;
        if ($student) {
            $this->applications->forStudent($student);
        }

        return UrgentDocumentRequestResource::make(
            $urgentDocumentRequest->fresh(['requester:id,name,email']),
        );
    }

    public function download(Request $request, StudentDocument $document): StreamedResponse
    {
        $this->assertCanAccessDocuments($request);
        abort_unless(UploadStorage::disk()->exists($document->file_path), 404);

        return UploadStorage::disk()->response(
            $document->file_path,
            $document->original_name,
            [
                'Content-Type' => $document->mime_type ?: 'application/octet-stream',
            ],
        );
    }

    public function updateStatus(
        UpdateStudentDocumentStatusRequest $request,
        StudentDocument $document,
    ): StudentDocumentResource {
        $this->assertCanAccessDocuments($request);

        $status = DocumentStatus::from($request->string('status')->toString());

        $student = $document->user;
        $beforeApplication = $this->applications->forStudent($student);
        $beforePreparationUnlockedAt = $beforeApplication->preparation_unlocked_at;

        $document->update([
            'status' => $status,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
            'rejection_reason' => $status === DocumentStatus::Rejected
                ? $request->string('rejection_reason')->toString()
                : null,
        ]);

        $document->load('user:id,name,email');

        $this->notifications->createForStudent(
            $document->user,
            $request->user(),
            $status === DocumentStatus::Approved
                ? 'Your document "'.$document->title.'" was approved.'
                : 'Your document "'.$document->title.'" was rejected. Reason: '.($document->rejection_reason ?? 'Not provided.'),
            $status === DocumentStatus::Approved ? 'document_approved' : 'document_rejected',
            '/student-documents',
        );

        $this->handoffs->syncDocuments($document->user, $request->user());

        if ($status === DocumentStatus::Approved) {
            $this->applications->resolveFulfilledUrgentRequests($document->user->id);
        }

        $afterApplication = $this->applications->forStudent($document->user);

        if ($beforePreparationUnlockedAt === null && $afterApplication->preparation_unlocked_at !== null) {
            $this->notifications->createForStudent(
                $document->user,
                $request->user(),
                'Preparation is now unlocked. Check your "Preparation" screen.',
                'preparation_unlocked',
                '/student-preparation',
            );
        }

        return StudentDocumentResource::make($document);
    }

    private function assertCanAccessDocuments(Request $request): void
    {
        $user = $request->user();

        abort_unless(
            $user
                && (
                    $user->hasAppPermission(Permission::StudentInfoView)
                    || $user->hasAppPermission(Permission::StudentInfoManage)
                ),
            403,
            'Only Student Info staff and Super Admin can access student documents.',
        );
    }

    private function assertCanManageDocuments(Request $request): void
    {
        $user = $request->user();

        abort_unless(
            $user && $user->hasAppPermission(Permission::StudentInfoManage),
            403,
            'Only Student Info staff and Super Admin can request urgent documents.',
        );
    }
}
