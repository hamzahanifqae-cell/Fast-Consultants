<?php

namespace App\Http\Controllers\Api;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreStudentDocumentRequest;
use App\Http\Requests\Api\UpdateStudentDocumentRequest;
use App\Http\Resources\StudentDocumentResource;
use App\Models\StudentDocument;
use App\Services\StudentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StudentDocumentController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
    ) {
    }
    public function index(Request $request): AnonymousResourceCollection
    {
        $documents = StudentDocument::query()
            ->where('user_id', $request->user()->id)
            ->latest()
            ->get();

        return StudentDocumentResource::collection($documents);
    }

    public function store(StoreStudentDocumentRequest $request): JsonResponse
    {
        $type = $request->enum('type', DocumentType::class);
        $file = $request->file('file');

        $path = $file->store(
            'student-documents/'.$request->user()->id,
            'local',
        );

        $document = StudentDocument::query()->create([
            'user_id' => $request->user()->id,
            'type' => $type,
            'title' => $request->string('title')->toString() ?: $type->label(),
            'original_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize() ?: 0,
            'status' => DocumentStatus::Pending,
        ]);

        $studentName = $request->user()->name;
        $this->notifications->notifyDepartments(
            [StaffDepartment::StudentInfo, StaffDepartment::Universities],
            $request->user(),
            "{$studentName} uploaded a document for review: {$document->title}.",
            'document_uploaded',
            '/departments/documents',
        );

        return StudentDocumentResource::make($document)
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdateStudentDocumentRequest $request, StudentDocument $document): StudentDocumentResource
    {
        abort_unless($document->user_id === $request->user()->id, 403);
        abort_unless(
            in_array($document->status, [DocumentStatus::Pending, DocumentStatus::Rejected], true),
            422,
            'Only pending or rejected documents can be edited.',
        );

        $type = $request->enum('type', DocumentType::class);
        $title = $request->string('title')->toString() ?: $type->label();
        $file = $request->file('file');

        $attributes = [
            'type' => $type,
            'title' => $title,
            'status' => DocumentStatus::Pending,
            'reviewed_by' => null,
            'reviewed_at' => null,
            'rejection_reason' => null,
        ];

        if ($file) {
            $path = $file->store(
                'student-documents/'.$request->user()->id,
                'local',
            );
            $document->deleteFile();
            $attributes['original_name'] = $file->getClientOriginalName();
            $attributes['file_path'] = $path;
            $attributes['mime_type'] = $file->getClientMimeType();
            $attributes['file_size'] = $file->getSize() ?: 0;
        }

        $document->update($attributes);

        $studentName = $request->user()->name;
        $this->notifications->notifyDepartments(
            [StaffDepartment::StudentInfo, StaffDepartment::Universities],
            $request->user(),
            "{$studentName} updated a document for review: {$document->title}.",
            'document_uploaded',
            '/departments/documents',
        );

        return StudentDocumentResource::make($document->fresh());
    }

    public function destroy(Request $request, StudentDocument $document): JsonResponse
    {
        abort_unless($document->user_id === $request->user()->id, 403);
        abort_unless(
            in_array($document->status, [DocumentStatus::Pending, DocumentStatus::Rejected], true),
            422,
            'Only pending or rejected documents can be deleted.',
        );

        $document->deleteFile();
        $document->delete();

        return response()->json([
            'message' => 'Document deleted.',
        ]);
    }

    public function download(Request $request, StudentDocument $document): StreamedResponse
    {
        abort_unless($document->user_id === $request->user()->id, 403);
        abort_unless(Storage::disk('local')->exists($document->file_path), 404);

        return Storage::disk('local')->download(
            $document->file_path,
            $document->original_name,
        );
    }
}
