<?php

namespace App\Services;

use App\Enums\ApplicationStage;
use App\Enums\ChargeReceiptStatus;
use App\Enums\DocumentStatus;
use App\Enums\InterviewStatus;
use App\Models\ChargeReceipt;
use App\Models\StudentApplication;
use App\Models\StudentDocument;
use App\Models\UrgentDocumentRequest;
use App\Models\User;
use Illuminate\Support\Collection;

class StudentApplicationService
{
    public function forStudent(User $student): StudentApplication
    {
        $application = StudentApplication::query()->firstOrCreate(
            ['student_id' => $student->id],
            [
                'stage' => ApplicationStage::DocumentsAndCharges,
                'interview_status' => InterviewStatus::NotScheduled,
            ],
        );

        return $this->syncAcceptance($application);
    }

    public function resolveFulfilledUrgentRequests(int $studentId): void
    {
        $open = UrgentDocumentRequest::query()
            ->where('student_id', $studentId)
            ->whereNull('resolved_at')
            ->get();

        foreach ($open as $request) {
            $fulfilled = StudentDocument::query()
                ->where('user_id', $studentId)
                ->where('type', $request->document_type)
                ->where('status', DocumentStatus::Approved)
                ->where(function ($query) use ($request) {
                    $query->where('reviewed_at', '>=', $request->created_at)
                        ->orWhere('updated_at', '>=', $request->created_at);
                })
                ->exists();

            if ($fulfilled) {
                $request->update(['resolved_at' => now()]);
            }
        }
    }

    public function syncAcceptance(StudentApplication $application): StudentApplication
    {
        $this->resolveFulfilledUrgentRequests($application->student_id);

        $documents = StudentDocument::query()
            ->where('user_id', $application->student_id)
            ->get();

        $receipts = ChargeReceipt::query()
            ->where('student_id', $application->student_id)
            ->get();

        $hasOpenUrgent = UrgentDocumentRequest::query()
            ->where('student_id', $application->student_id)
            ->whereNull('resolved_at')
            ->exists();

        $documentsAccepted = $documents->isNotEmpty()
            && $documents->every(fn (StudentDocument $document) => $document->status === DocumentStatus::Approved)
            && ! $hasOpenUrgent;

        $receiptsAccepted = $receipts->isNotEmpty()
            && $receipts->every(fn (ChargeReceipt $receipt) => $receipt->status === ChargeReceiptStatus::Approved);

        $everythingAccepted = $documentsAccepted && $receiptsAccepted;

        $updates = [
            'everything_accepted' => $everythingAccepted,
        ];

        if ($everythingAccepted && $application->preparation_unlocked_at === null) {
            $updates['preparation_unlocked_at'] = now();
            $updates['preparation_title'] = $application->preparation_title
                ?: 'Interview preparation';
            $updates['preparation_body'] = $application->preparation_body
                ?: "Your documents and charge slips are accepted.\n\nPrepare for your interview by reviewing your personal details, uploaded documents, and university requirements. Practice common admission questions and keep your passport ready.";
        }

        if ($everythingAccepted && in_array($application->stage, [
            ApplicationStage::DocumentsAndCharges,
        ], true)) {
            $updates['stage'] = ApplicationStage::Preparation;
        }

        if ((! $everythingAccepted || $hasOpenUrgent) && $application->stage !== ApplicationStage::Completed) {
            $updates['stage'] = ApplicationStage::DocumentsAndCharges;
            $updates['preparation_unlocked_at'] = null;
            $updates['interview_unlocked_at'] = null;
        }

        $application->fill($updates)->save();

        return $application->fresh(['student:id,name,email', 'consultant:id,name,email']) ?? $application;
    }

    /**
     * @return array<string, mixed>
     */
    public function statusPayload(StudentApplication $application): array
    {
        $application = $this->syncAcceptance($application);

        $documents = StudentDocument::query()
            ->where('user_id', $application->student_id)
            ->get();

        $receipts = ChargeReceipt::query()
            ->where('student_id', $application->student_id)
            ->get();

        $documentsApproved = $documents->where('status', DocumentStatus::Approved)->count();
        $documentsPending = $documents->where('status', DocumentStatus::Pending)->count();
        $documentsRejected = $documents->where('status', DocumentStatus::Rejected)->count();

        $receiptsApproved = $receipts->where('status', ChargeReceiptStatus::Approved)->count();
        $receiptsPending = $receipts->whereIn('status', [
            ChargeReceiptStatus::AwaitingStudent,
            ChargeReceiptStatus::AwaitingReview,
        ])->count();
        $receiptsRejected = $receipts->where('status', ChargeReceiptStatus::Rejected)->count();

        $universityDocuments = $this->universityDocumentsChecklist($application->student_id, $documents);
        $urgentDocuments = $this->urgentDocumentsChecklist($application->student_id, $documents);
        $documentsAccepted = $documents->isNotEmpty()
            && $documentsPending === 0
            && $documentsRejected === 0
            && $documentsApproved === $documents->count()
            && $urgentDocuments['complete'];

        $currentStatus = $application->stage->label();
        if (! $urgentDocuments['complete'] && $urgentDocuments['required'] > 0) {
            $currentStatus = 'Urgent documents';
        } elseif ($documentsAccepted && ! $universityDocuments['complete'] && $universityDocuments['required'] > 0) {
            $currentStatus = 'Documents — university requirements';
        }

        return [
            'application' => $application,
            'checklist' => [
                'documents' => [
                    'total' => $documents->count(),
                    'approved' => $documentsApproved,
                    'pending' => $documentsPending,
                    'rejected' => $documentsRejected,
                    'accepted' => $documentsAccepted,
                ],
                'urgent_documents' => $urgentDocuments,
                'university_documents' => $universityDocuments,
                'charge_receipts' => [
                    'total' => $receipts->count(),
                    'approved' => $receiptsApproved,
                    'pending' => $receiptsPending,
                    'rejected' => $receiptsRejected,
                    'accepted' => $receipts->isNotEmpty() && $receiptsPending === 0 && $receiptsRejected === 0 && $receiptsApproved === $receipts->count(),
                ],
            ],
            // What the next department in the chain is allowed to start.
            'handoff' => [
                'documents_approved' => $documents->isNotEmpty()
                    && $documentsApproved === $documents->count()
                    && $urgentDocuments['complete'],
                'universities_shared' => $application->student
                    ? $application->student->assignedUniversities()->exists()
                    : false,
                'fees_cleared' => $receipts->isNotEmpty()
                    && $receiptsApproved === $receipts->count(),
            ],
            'preparation_available' => $application->everything_accepted && $application->preparation_unlocked_at !== null,
            'interview_available' => $application->interview_unlocked_at !== null
                || in_array($application->stage, [ApplicationStage::Interview, ApplicationStage::Completed], true),
            'current_status' => $currentStatus,
        ];
    }

    /**
     * @param  Collection<int, StudentDocument>  $documents
     * @return array{
     *     required: int,
     *     covered: int,
     *     pending: int,
     *     action_needed: int,
     *     complete: bool,
     *     missing: list<array{type: string, label: string, status: string, note: ?string, id: int}>
     * }
     */
    private function urgentDocumentsChecklist(int $studentId, Collection $documents): array
    {
        $requests = UrgentDocumentRequest::query()
            ->where('student_id', $studentId)
            ->whereNull('resolved_at')
            ->latest()
            ->get();

        $items = $requests->map(function (UrgentDocumentRequest $request) use ($documents) {
            $matches = $documents->filter(
                fn (StudentDocument $document) => $document->type === $request->document_type,
            );
            $status = 'missing';
            if ($matches->contains(fn (StudentDocument $document) => $document->status === DocumentStatus::Approved
                && (
                    ($document->reviewed_at !== null && $document->reviewed_at >= $request->created_at)
                    || $document->updated_at >= $request->created_at
                ))) {
                $status = 'approved';
            } elseif ($matches->contains(fn (StudentDocument $document) => $document->status === DocumentStatus::Pending)) {
                $status = 'pending';
            } elseif ($matches->contains(fn (StudentDocument $document) => $document->status === DocumentStatus::Rejected)) {
                $status = 'rejected';
            }

            return [
                'id' => $request->id,
                'type' => $request->document_type->value,
                'label' => $request->document_type->label(),
                'status' => $status,
                'note' => $request->note,
            ];
        });

        $covered = $items->where('status', 'approved')->count();
        $pending = $items->where('status', 'pending')->count();
        $actionNeeded = $items->whereIn('status', ['missing', 'rejected'])->count();
        $requiredCount = $items->count();

        return [
            'required' => $requiredCount,
            'covered' => $covered,
            'pending' => $pending,
            'action_needed' => $actionNeeded,
            'complete' => $requiredCount === 0,
            'missing' => $items
                ->whereIn('status', ['missing', 'rejected', 'pending'])
                ->values()
                ->all(),
        ];
    }

    /**
     * @param  Collection<int, StudentDocument>  $documents
     * @return array{
     *     required: int,
     *     covered: int,
     *     pending: int,
     *     action_needed: int,
     *     complete: bool,
     *     missing: list<array{type: string, label: string, status: string}>
     * }
     */
    private function universityDocumentsChecklist(int $studentId, Collection $documents): array
    {
        $student = User::query()->find($studentId);
        if (! $student) {
            return [
                'required' => 0,
                'covered' => 0,
                'pending' => 0,
                'action_needed' => 0,
                'complete' => true,
                'missing' => [],
            ];
        }

        $required = $student->assignedUniversities()
            ->with('requiredDocuments')
            ->get()
            ->flatMap(fn ($university) => $university->requiredDocuments)
            ->unique(fn ($requirement) => $requirement->document_type->value)
            ->values();

        $items = $required->map(function ($requirement) use ($documents) {
            $type = $requirement->document_type->value;
            $matches = $documents->filter(
                fn (StudentDocument $document) => $document->type === $requirement->document_type,
            );
            $status = 'missing';
            if ($matches->contains(fn (StudentDocument $document) => $document->status === DocumentStatus::Approved)) {
                $status = 'approved';
            } elseif ($matches->contains(fn (StudentDocument $document) => $document->status === DocumentStatus::Pending)) {
                $status = 'pending';
            } elseif ($matches->contains(fn (StudentDocument $document) => $document->status === DocumentStatus::Rejected)) {
                $status = 'rejected';
            }

            return [
                'type' => $type,
                'label' => $requirement->document_type->label(),
                'status' => $status,
            ];
        });

        $covered = $items->where('status', 'approved')->count();
        $pending = $items->where('status', 'pending')->count();
        $actionNeeded = $items->whereIn('status', ['missing', 'rejected'])->count();
        $requiredCount = $items->count();

        return [
            'required' => $requiredCount,
            'covered' => $covered,
            'pending' => $pending,
            'action_needed' => $actionNeeded,
            'complete' => $requiredCount === 0 || $covered >= $requiredCount,
            'missing' => $items
                ->whereIn('status', ['missing', 'rejected', 'pending'])
                ->values()
                ->all(),
        ];
    }
}
