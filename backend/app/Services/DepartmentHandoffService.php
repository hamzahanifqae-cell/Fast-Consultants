<?php

namespace App\Services;

use App\Enums\ChargeReceiptStatus;
use App\Enums\DocumentStatus;
use App\Enums\StaffDepartment;
use App\Models\ChargeReceipt;
use App\Models\StudentDocument;
use App\Models\User;

/**
 * Passes a student along the department chain:
 * Student Info approves documents -> Universities share options -> Finance clears
 * the charges -> Interview schedules the meeting.
 *
 * Each step notifies the next department once, and rolls back if the step stops
 * being complete (a new document to review, a removed university, a fresh charge)
 * so the hand-off fires again when it is finished for real.
 */
class DepartmentHandoffService
{
    public function __construct(
        private readonly StudentApplicationService $applications,
        private readonly StudentNotificationService $notifications,
    ) {
    }

    /** Student Info is done: every uploaded document is approved. */
    public function documentsApproved(User $student): bool
    {
        $documents = StudentDocument::query()
            ->where('user_id', $student->id)
            ->get();

        return $documents->isNotEmpty()
            && $documents->every(
                fn (StudentDocument $document) => $document->status === DocumentStatus::Approved
            );
    }

    /** Universities is done: the student has at least one shared option. */
    public function universitiesShared(User $student): bool
    {
        return $student->assignedUniversities()->exists();
    }

    /** Finance is done: every charge slip is approved. */
    public function feesCleared(User $student): bool
    {
        $receipts = ChargeReceipt::query()
            ->where('student_id', $student->id)
            ->get();

        return $receipts->isNotEmpty()
            && $receipts->every(
                fn (ChargeReceipt $receipt) => $receipt->status === ChargeReceiptStatus::Approved
            );
    }

    /** Every uploaded document approved: Universities can start sharing options. */
    public function syncDocuments(User $student, ?User $actor = null): void
    {
        $this->syncMilestone(
            $student,
            'documents_approved_at',
            $this->documentsApproved($student),
            StaffDepartment::Universities,
            $actor,
            "{$student->name}'s documents are all approved. Share university options with them.",
            'documents_approved',
            '/departments/universities',
        );
    }

    /** At least one university shared: Finance can raise the charges. */
    public function syncUniversities(User $student, ?User $actor = null): void
    {
        $this->syncMilestone(
            $student,
            'universities_shared_at',
            $this->universitiesShared($student),
            StaffDepartment::Finance,
            $actor,
            "{$student->name} has university options shared. Set up their charges.",
            'universities_shared',
            '/departments/finance',
        );
    }

    /** Every charge slip approved: Interview can schedule the meeting. */
    public function syncFees(User $student, ?User $actor = null): void
    {
        $this->syncMilestone(
            $student,
            'fees_cleared_at',
            $this->feesCleared($student),
            StaffDepartment::Interview,
            $actor,
            "{$student->name}'s charges are fully paid and approved. Schedule their interview.",
            'fees_cleared',
            '/departments/interview',
        );
    }

    private function syncMilestone(
        User $student,
        string $column,
        bool $reached,
        StaffDepartment $department,
        ?User $actor,
        string $message,
        string $type,
        string $action,
    ): void {
        $application = $this->applications->forStudent($student);

        if (! $reached) {
            if ($application->{$column} !== null) {
                $application->fill([$column => null])->save();
            }

            return;
        }

        if ($application->{$column} !== null) {
            return;
        }

        $application->fill([$column => now()])->save();

        $this->notifications->notifyDepartment(
            $department,
            $actor,
            $message,
            $type,
            $action,
        );
    }
}
