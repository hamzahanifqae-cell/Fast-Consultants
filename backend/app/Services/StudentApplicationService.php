<?php

namespace App\Services;

use App\Enums\ApplicationStage;
use App\Enums\ChargeReceiptStatus;
use App\Enums\DocumentStatus;
use App\Enums\InterviewStatus;
use App\Models\ChargeReceipt;
use App\Models\StudentApplication;
use App\Models\StudentDocument;
use App\Models\User;

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

    public function syncAcceptance(StudentApplication $application): StudentApplication
    {
        $documents = StudentDocument::query()
            ->where('user_id', $application->student_id)
            ->get();

        $receipts = ChargeReceipt::query()
            ->where('student_id', $application->student_id)
            ->get();

        $documentsAccepted = $documents->isNotEmpty()
            && $documents->every(fn (StudentDocument $document) => $document->status === DocumentStatus::Approved);

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

        if (! $everythingAccepted && $application->stage !== ApplicationStage::Completed) {
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

        return [
            'application' => $application,
            'checklist' => [
                'documents' => [
                    'total' => $documents->count(),
                    'approved' => $documentsApproved,
                    'pending' => $documentsPending,
                    'rejected' => $documentsRejected,
                    'accepted' => $documents->isNotEmpty() && $documentsPending === 0 && $documentsRejected === 0 && $documentsApproved === $documents->count(),
                ],
                'charge_receipts' => [
                    'total' => $receipts->count(),
                    'approved' => $receiptsApproved,
                    'pending' => $receiptsPending,
                    'rejected' => $receiptsRejected,
                    'accepted' => $receipts->isNotEmpty() && $receiptsPending === 0 && $receiptsRejected === 0 && $receiptsApproved === $receipts->count(),
                ],
            ],
            'preparation_available' => $application->everything_accepted && $application->preparation_unlocked_at !== null,
            'interview_available' => $application->interview_unlocked_at !== null
                || in_array($application->stage, [ApplicationStage::Interview, ApplicationStage::Completed], true),
        ];
    }
}
