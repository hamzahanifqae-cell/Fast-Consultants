<?php

namespace App\Http\Controllers\Api;

use App\Enums\DocumentStatus;
use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateStudentDocumentStatusRequest;
use App\Http\Resources\StudentDocumentResource;
use App\Models\StudentDocument;
use App\Services\StudentApplicationService;
use App\Services\StudentNotificationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ConsultantStudentDocumentController extends Controller
{
    public function __construct(
        private readonly StudentApplicationService $applications,
        private readonly StudentNotificationService $notifications,
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

    public function download(Request $request, StudentDocument $document): StreamedResponse
    {
        $this->assertCanAccessDocuments($request);
        abort_unless(Storage::disk('local')->exists($document->file_path), 404);

        return Storage::disk('local')->response(
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
}
