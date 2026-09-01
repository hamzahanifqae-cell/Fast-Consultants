<?php

namespace App\Services;

use App\Enums\ApplicationStage;
use App\Enums\ChargeReceiptStatus;
use App\Enums\DocumentStatus;
use App\Enums\InterviewFollowupPreference;
use App\Enums\InterviewStatus;
use App\Enums\Role;
use App\Enums\VisaAppointmentStatus;
use App\Models\ChargeReceipt;
use App\Models\StudentApplication;
use App\Models\StudentDocument;
use App\Models\StudentProfile;
use App\Models\User;
use App\Models\VisaAppointment;
use Illuminate\Support\Collection;

class StudentProgressService
{
    public function __construct(
        private readonly StudentApplicationService $applications,
    ) {
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function allStudents(): array
    {
        $students = User::role(Role::Student)
            ->with(['studentProfile', 'assignedUniversities.requiredDocuments'])
            ->orderBy('name')
            ->get(['id', 'name', 'email']);

        if ($students->isEmpty()) {
            return [];
        }

        $ids = $students->pluck('id');

        $documentsByStudent = StudentDocument::query()
            ->whereIn('user_id', $ids)
            ->get()
            ->groupBy('user_id');

        $receiptsByStudent = ChargeReceipt::query()
            ->whereIn('student_id', $ids)
            ->get()
            ->groupBy('student_id');

        $appointmentsByStudent = VisaAppointment::query()
            ->whereIn('student_id', $ids)
            ->get()
            ->groupBy('student_id');

        $applicationsByStudent = StudentApplication::query()
            ->whereIn('student_id', $ids)
            ->get()
            ->keyBy('student_id');

        return $students
            ->map(function (User $student) use (
                $documentsByStudent,
                $receiptsByStudent,
                $appointmentsByStudent,
                $applicationsByStudent,
            ) {
                $documents = $documentsByStudent->get($student->id, collect());
                $receipts = $receiptsByStudent->get($student->id, collect());
                $appointments = $appointmentsByStudent->get($student->id, collect());
                $application = $applicationsByStudent->get($student->id)
                    ?? $this->applications->forStudent($student);

                return $this->forStudent(
                    $student,
                    $student->studentProfile,
                    $documents,
                    $receipts,
                    $appointments,
                    $application,
                    $student->assignedUniversities,
                );
            })
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, StudentDocument>  $documents
     * @param  Collection<int, ChargeReceipt>  $receipts
     * @param  Collection<int, VisaAppointment>  $appointments
     * @param  Collection<int, \App\Models\University>  $universities
     * @return array<string, mixed>
     */
    public function forStudent(
        User $student,
        ?StudentProfile $profile,
        Collection $documents,
        Collection $receipts,
        Collection $appointments,
        StudentApplication $application,
        Collection $universities,
    ): array {
        $checklist = $this->checklist($documents, $receipts);
        $preparationAvailable = $checklist['documents']['accepted']
            && $checklist['charge_receipts']['accepted']
            && $application->preparation_unlocked_at !== null;
        $interviewAvailable = $application->interview_unlocked_at !== null
            || in_array($application->stage, [ApplicationStage::Interview, ApplicationStage::Completed], true);

        $personal = $this->profileProgress($student, $profile);
        $docs = $this->documentsProgress($documents);
        $unis = $this->universitiesProgress($universities, $documents);
        $fees = $this->feesProgress($receipts);
        $interview = $this->interviewProgress($application, $preparationAvailable, $interviewAvailable);
        $visa = $this->visaProgress($appointments);
        $status = $this->statusProgress(
            $checklist,
            $application,
            $appointments,
            $application->stage->label(),
        );

        $sections = [
            'personal' => $personal,
            'documents' => $docs,
            'universities' => $unis,
            'fees' => $fees,
            'interview' => $interview,
            'visa' => $visa,
            'status' => $status,
        ];

        $overall = (int) round(
            collect($sections)->avg(fn (array $section) => $section['percent']),
        );

        return [
            'id' => $student->id,
            'name' => $student->name,
            'email' => $student->email,
            'current_status' => $application->stage->label(),
            'overall_percent' => $overall,
            'sections' => $sections,
        ];
    }

    /**
     * @param  Collection<int, StudentDocument>  $documents
     * @param  Collection<int, ChargeReceipt>  $receipts
     * @return array{documents: array<string, mixed>, charge_receipts: array<string, mixed>}
     */
    private function checklist(Collection $documents, Collection $receipts): array
    {
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
            'documents' => [
                'total' => $documents->count(),
                'approved' => $documentsApproved,
                'pending' => $documentsPending,
                'rejected' => $documentsRejected,
                'accepted' => $documents->isNotEmpty()
                    && $documentsPending === 0
                    && $documentsRejected === 0
                    && $documentsApproved === $documents->count(),
            ],
            'charge_receipts' => [
                'total' => $receipts->count(),
                'approved' => $receiptsApproved,
                'pending' => $receiptsPending,
                'rejected' => $receiptsRejected,
                'accepted' => $receipts->isNotEmpty()
                    && $receiptsPending === 0
                    && $receiptsRejected === 0
                    && $receiptsApproved === $receipts->count(),
            ],
        ];
    }

    /**
     * @return array{percent: int, complete: bool, report: string, meta: string}
     */
    private function profileProgress(User $student, ?StudentProfile $profile): array
    {
        if (! $profile) {
            return [
                'percent' => 0,
                'complete' => false,
                'report' => 'Personal, Education, Job, Other',
                'meta' => 'Personal details',
            ];
        }

        $sections = [
            [
                'label' => 'Personal',
                ...$this->scoreFields([
                    $student->name,
                    $profile->phone,
                    $profile->date_of_birth?->toDateString(),
                    $profile->gender?->value,
                    $profile->nationality,
                    $profile->country_of_residence,
                    $profile->city,
                    $profile->address,
                    $profile->passport_number,
                    $profile->cnic_number,
                ]),
            ],
            [
                'label' => 'Education',
                ...$this->scoreFields([
                    $profile->education_level,
                    $profile->institution_name,
                    $profile->field_of_study,
                    $profile->graduation_year,
                ]),
            ],
            [
                'label' => 'Job',
                ...$this->scoreFields([
                    $profile->job_title,
                    $profile->employer_name,
                    $profile->years_of_experience,
                ]),
            ],
            [
                'label' => 'Other',
                ...$this->scoreFields([$profile->other_information]),
            ],
        ];

        $filled = collect($sections)->sum('filled');
        $total = collect($sections)->sum('total');
        $percent = $total === 0 ? 0 : (int) round(($filled / $total) * 100);
        $complete = collect($sections)->every(fn (array $section) => $section['complete']);

        return [
            'percent' => $percent,
            'complete' => $complete,
            'report' => collect($sections)
                ->map(fn (array $section) => $section['complete']
                    ? "{$section['label']} ✓"
                    : "{$section['label']} {$section['percent']}%")
                ->implode(', '),
            'meta' => $complete ? 'All sections complete' : 'Personal details',
        ];
    }

    /**
     * @param  Collection<int, StudentDocument>  $documents
     * @return array{percent: int, complete: bool, report: string, meta: string}
     */
    private function documentsProgress(Collection $documents): array
    {
        $total = $documents->count();
        $approved = $documents->where('status', DocumentStatus::Approved)->count();
        $pending = $documents->where('status', DocumentStatus::Pending)->count();
        $rejected = $documents->where('status', DocumentStatus::Rejected)->count();

        if ($total === 0) {
            return [
                'percent' => 0,
                'complete' => false,
                'report' => 'Upload, Review, Approved',
                'meta' => 'No files yet',
            ];
        }

        $percent = $rejected > 0
            ? (int) round(($approved / $total) * 100)
            : ($pending > 0
                ? (int) round((($approved + ($pending * 0.5)) / $total) * 100)
                : 100);

        $complete = $approved === $total && $rejected === 0 && $pending === 0;

        return [
            'percent' => $percent,
            'complete' => $complete,
            'report' => "Approved {$approved}, Pending {$pending}, Rejected {$rejected}",
            'meta' => $complete ? 'Documents complete' : 'Document review',
        ];
    }

    /**
     * @param  Collection<int, \App\Models\University>  $universities
     * @param  Collection<int, StudentDocument>  $documents
     * @return array{percent: int, complete: bool, report: string, meta: string}
     */
    private function universitiesProgress(Collection $universities, Collection $documents): array
    {
        if ($universities->isEmpty()) {
            return [
                'percent' => 0,
                'complete' => false,
                'report' => 'Waiting, Options, Required docs',
                'meta' => 'No options yet',
            ];
        }

        $requiredTypes = $universities
            ->flatMap(fn ($university) => $university->requiredDocuments->map(
                fn ($requirement) => $requirement->document_type->value,
            ))
            ->unique()
            ->values();

        $approvedTypes = $documents
            ->where('status', DocumentStatus::Approved)
            ->map(fn (StudentDocument $document) => $document->type->value)
            ->unique();

        $covered = $requiredTypes->filter(fn (string $type) => $approvedTypes->contains($type))->count();
        $requiredCount = $requiredTypes->count();
        $percent = $requiredCount === 0 ? 100 : (int) round(($covered / $requiredCount) * 100);
        $complete = $requiredCount === 0 || $covered >= $requiredCount;
        $uniCount = $universities->count();

        return [
            'percent' => $percent,
            'complete' => $complete,
            'report' => "{$uniCount} option".($uniCount === 1 ? '' : 's').', '.$covered.'/'.max($requiredCount, 1).' docs ready',
            'meta' => $complete ? 'Universities ready' : 'University options',
        ];
    }

    /**
     * @param  Collection<int, ChargeReceipt>  $receipts
     * @return array{percent: int, complete: bool, report: string, meta: string}
     */
    private function feesProgress(Collection $receipts): array
    {
        $total = $receipts->count();
        $approved = $receipts->where('status', ChargeReceiptStatus::Approved)->count();
        $review = $receipts->where('status', ChargeReceiptStatus::AwaitingReview)->count();
        $action = $receipts->whereIn('status', [
            ChargeReceiptStatus::AwaitingStudent,
            ChargeReceiptStatus::Rejected,
        ])->count();

        if ($total === 0) {
            return [
                'percent' => 0,
                'complete' => false,
                'report' => 'Waiting, Pay, Approved',
                'meta' => 'No slips yet',
            ];
        }

        $percent = $action > 0
            ? (int) round(($approved / $total) * 100)
            : ($review > 0
                ? (int) round((($approved + ($review * 0.5)) / $total) * 100)
                : 100);
        $complete = $approved === $total;

        return [
            'percent' => $percent,
            'complete' => $complete,
            'report' => "Approved {$approved}, Review {$review}, Action {$action}",
            'meta' => $complete ? 'Fees complete' : 'Charge receipts',
        ];
    }

    /**
     * @return array{percent: int, complete: bool, report: string, meta: string}
     */
    private function interviewProgress(
        StudentApplication $application,
        bool $preparationAvailable,
        bool $interviewAvailable,
    ): array {
        if (! $preparationAvailable) {
            return [
                'percent' => 0,
                'complete' => false,
                'report' => 'Locked, Prep, Meeting',
                'meta' => 'Locked',
            ];
        }

        $prepDone = $application->preparation_completed_at !== null;
        $meetingDone = $application->interview_meeting_ended_at !== null;
        $scheduled = $application->interview_at !== null;
        $declined = $application->interview_followup_preference === InterviewFollowupPreference::DeclineAnother;
        $wantsAnother = $application->interview_followup_preference === InterviewFollowupPreference::WantAnother;
        $interviewComplete = in_array($application->interview_status, [
            InterviewStatus::Completed,
            InterviewStatus::Passed,
            InterviewStatus::Failed,
        ], true) || ($meetingDone && $declined);

        $prepPct = $prepDone ? 100 : 0;
        $meetingPct = $interviewComplete || $meetingDone
            ? 100
            : ($scheduled ? 70 : ($interviewAvailable ? 40 : 0));
        $followPct = $interviewComplete
            ? 100
            : ($wantsAnother
                ? 50
                : ($meetingDone && $application->interview_followup_preference === null
                    ? 25
                    : ($meetingDone ? 75 : 0)));

        $percent = (int) round(($prepPct + $meetingPct + $followPct) / 3);

        return [
            'percent' => $percent,
            'complete' => $interviewComplete,
            'report' => "Prep {$prepPct}%, Meeting {$meetingPct}%, Follow-up {$followPct}%",
            'meta' => $interviewComplete
                ? 'Interview complete'
                : ($interviewAvailable ? 'Interview open' : 'Preparation'),
        ];
    }

    /**
     * @param  Collection<int, VisaAppointment>  $appointments
     * @return array{percent: int, complete: bool, report: string, meta: string}
     */
    private function visaProgress(Collection $appointments): array
    {
        $total = $appointments->count();
        $scheduled = $appointments->where('status', VisaAppointmentStatus::Scheduled)->count();
        $completed = $appointments->where('status', VisaAppointmentStatus::Completed)->count();

        if ($total === 0) {
            return [
                'percent' => 0,
                'complete' => false,
                'report' => 'Waiting, Scheduled, Completed',
                'meta' => 'No appointments yet',
            ];
        }

        $percent = $completed > 0 && $scheduled === 0
            ? 100
            : (int) round((($completed + ($scheduled * 0.5)) / $total) * 100);
        $complete = $completed > 0 && $scheduled === 0;

        return [
            'percent' => $percent,
            'complete' => $complete,
            'report' => "Scheduled {$scheduled}, Completed {$completed}",
            'meta' => $complete ? 'Visa complete' : 'Visa appointments',
        ];
    }

    /**
     * @param  array{documents: array<string, mixed>, charge_receipts: array<string, mixed>}  $checklist
     * @param  Collection<int, VisaAppointment>  $appointments
     * @return array{percent: int, complete: bool, report: string, meta: string}
     */
    private function statusProgress(
        array $checklist,
        StudentApplication $application,
        Collection $appointments,
        string $currentStatus,
    ): array {
        $interviewDone = in_array($application->interview_status, [
            InterviewStatus::Completed,
            InterviewStatus::Passed,
            InterviewStatus::Failed,
        ], true) || (
            $application->interview_meeting_ended_at !== null
            && $application->interview_followup_preference === InterviewFollowupPreference::DeclineAnother
        );

        $steps = [
            ['label' => 'Docs', 'done' => (bool) $checklist['documents']['accepted']],
            ['label' => 'Fees', 'done' => (bool) $checklist['charge_receipts']['accepted']],
            ['label' => 'Prep', 'done' => $application->preparation_completed_at !== null],
            ['label' => 'Interview', 'done' => $interviewDone || $application->interview_at !== null],
            [
                'label' => 'Visa',
                'done' => $appointments->contains(fn (VisaAppointment $item) => in_array(
                    $item->status,
                    [VisaAppointmentStatus::Completed, VisaAppointmentStatus::Scheduled],
                    true,
                )),
            ],
        ];

        $done = collect($steps)->where('done', true)->count();
        $percent = (int) round(($done / count($steps)) * 100);
        $complete = $done === count($steps);

        return [
            'percent' => $percent,
            'complete' => $complete,
            'report' => collect($steps)
                ->map(fn (array $step) => $step['done'] ? "{$step['label']} ✓" : "{$step['label']} pending")
                ->implode(', '),
            'meta' => $currentStatus,
        ];
    }

    /**
     * @param  list<string|null>  $fields
     * @return array{filled: int, total: int, percent: int, complete: bool}
     */
    private function scoreFields(array $fields): array
    {
        $total = count($fields);
        $filled = collect($fields)
            ->filter(fn ($value) => filled($value) && trim((string) $value) !== '')
            ->count();

        return [
            'filled' => $filled,
            'total' => $total,
            'percent' => $total === 0 ? 0 : (int) round(($filled / $total) * 100),
            'complete' => $total > 0 && $filled >= $total,
        ];
    }
}
