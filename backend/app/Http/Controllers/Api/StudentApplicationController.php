<?php

namespace App\Http\Controllers\Api;

use App\Enums\ApplicationStage;
use App\Enums\InterviewFollowupPreference;
use App\Enums\InterviewStatus;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\UpdateStudentApplicationRequest;
use App\Http\Resources\StudentApplicationResource;
use App\Models\User;
use App\Services\StudentApplicationService;
use App\Services\StudentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class StudentApplicationController extends Controller
{
    public function __construct(
        private readonly StudentApplicationService $applications,
        private readonly StudentNotificationService $notifications,
    )
    {
    }

    public function studentStatus(Request $request): JsonResponse
    {
        $payload = $this->applications->statusPayload(
            $this->applications->forStudent($request->user()),
        );

        return response()->json([
            'data' => [
                'application' => StudentApplicationResource::make($payload['application'])->resolve(),
                'checklist' => $payload['checklist'],
                'preparation_available' => $payload['preparation_available'],
                'interview_available' => $payload['interview_available'],
                'current_status' => $payload['application']->stage->label(),
            ],
        ]);
    }

    public function consultantIndex(Request $request): AnonymousResourceCollection
    {
        $students = User::role('student')->orderBy('name')->get();

        $applications = $students->map(
            fn (User $student) => $this->applications->forStudent($student),
        );

        return StudentApplicationResource::collection($applications);
    }

    public function consultantShow(Request $request, User $student): JsonResponse
    {
        abort_unless($student->isStudent(), 404);

        $payload = $this->applications->statusPayload(
            $this->applications->forStudent($student),
        );

        return response()->json([
            'data' => [
                'application' => StudentApplicationResource::make($payload['application'])->resolve(),
                'checklist' => $payload['checklist'],
                'preparation_available' => $payload['preparation_available'],
                'interview_available' => $payload['interview_available'],
                'current_status' => $payload['application']->stage->label(),
            ],
        ]);
    }

    public function consultantUpdate(
        UpdateStudentApplicationRequest $request,
        User $student,
    ): JsonResponse {
        abort_unless($student->isStudent(), 404);

        $application = $this->applications->forStudent($student);
        $application->consultant_id = $request->user()->id;

        $beforeStage = $application->stage;
        $beforeInterviewUnlockedAt = $application->interview_unlocked_at;

        if ($request->exists('preparation_title') || $request->exists('preparation_body')) {
            $this->notifications->createForStudent(
                $student,
                $request->user(),
                'Preparation notes were updated by your consultant.',
                'preparation_updated',
                '/student-preparation',
            );
        }

        if ($request->exists('preparation_title')) {
            $application->preparation_title = $request->input('preparation_title');
        }

        if ($request->exists('preparation_body')) {
            $application->preparation_body = $request->input('preparation_body');
        }

        if ($request->boolean('mark_preparation_complete')) {
            $application->preparation_completed_at = now();
        }

        if ($request->boolean('unlock_interview') || $request->filled('interview_at')) {
            $application->interview_unlocked_at = $application->interview_unlocked_at ?? now();
            $application->stage = ApplicationStage::Interview;
            $application->preparation_completed_at = $application->preparation_completed_at ?? now();
        }

        if ($request->exists('interview_at')) {
            $incomingAt = $request->input('interview_at');
            $previousAt = $application->interview_at?->toIso8601String();
            $nextAt = $incomingAt ? (string) $incomingAt : null;

            if ($nextAt !== $previousAt) {
                $application->interview_reminder_1h_sent_at = null;
                $application->interview_reminder_15m_sent_at = null;
                $application->interview_starting_sent_at = null;
                $application->interview_student_joined_at = null;
                $application->interview_staff_joined_at = null;
            }

            $application->interview_at = $incomingAt;
            if ($incomingAt) {
                $application->interview_status = InterviewStatus::Scheduled;
                $application->interview_followup_preference = null;
                $application->interview_followup_preference_at = null;
                $application->interview_meeting_ended_at = null;
            }
        }

        if ($request->exists('interview_mode')) {
            $application->interview_mode = $request->input('interview_mode');
        }

        if ($request->exists('interview_location')) {
            $application->interview_location = $request->input('interview_location');
        }

        if ($request->exists('interview_notes')) {
            $application->interview_notes = $request->input('interview_notes');
        }

        if ($request->filled('interview_status')) {
            $application->interview_status = InterviewStatus::from($request->string('interview_status')->toString());

            if (in_array($application->interview_status, [
                InterviewStatus::Completed,
                InterviewStatus::Passed,
                InterviewStatus::Failed,
            ], true)) {
                $application->stage = ApplicationStage::Completed;
            }
        }

        if ($request->filled('stage')) {
            $application->stage = ApplicationStage::from($request->string('stage')->toString());
        }

        $application->save();

        if ($beforeInterviewUnlockedAt === null && $application->interview_unlocked_at !== null) {
            $this->notifications->createForStudent(
                $student,
                $request->user(),
                $application->interview_at
                    ? 'Interview is scheduled. Open your Interview screen to see details.'
                    : 'Interview is now available. Open your Interview screen to see details.',
                'interview_unlocked',
                '/student-interview',
            );
        }

        if ($request->filled('interview_at') && $application->interview_at) {
            $when = $application->interview_at->format('M j, Y \a\t g:i A');
            $this->notifications->createForStudent(
                $student,
                $request->user(),
                "Interview scheduled for {$when}. You'll get reminders before the session, open Interview to join the online prep video call.",
                'interview_scheduled',
                '/student-interview',
            );
        }

        if ($beforeStage !== ApplicationStage::Completed && $application->stage === ApplicationStage::Completed) {
            $this->notifications->createForStudent(
                $student,
                $request->user(),
                'Your application stage was marked as completed by your consultant.',
                'application_completed',
                '/student-status',
            );
        }

        $payload = $this->applications->statusPayload($application->fresh());

        return response()->json([
            'data' => [
                'application' => StudentApplicationResource::make($payload['application'])->resolve(),
                'checklist' => $payload['checklist'],
                'preparation_available' => $payload['preparation_available'],
                'interview_available' => $payload['interview_available'],
                'current_status' => $payload['application']->stage->label(),
            ],
        ]);
    }

    public function studentCompletePreparation(Request $request): JsonResponse
    {
        $application = $this->applications->forStudent($request->user());

        abort_unless($application->everything_accepted, 422, 'Preparation unlocks after documents and charge slips are accepted.');

        $application->preparation_completed_at = now();
        $application->save();

        $this->notifications->notifyDepartments(
            [StaffDepartment::Interview, StaffDepartment::Visa],
            $request->user(),
            $request->user()->name.' marked preparation as complete.',
            'preparation_completed',
            '/departments/interview',
        );

        $payload = $this->applications->statusPayload($application->fresh());

        return response()->json([
            'data' => [
                'application' => StudentApplicationResource::make($payload['application'])->resolve(),
                'checklist' => $payload['checklist'],
                'preparation_available' => $payload['preparation_available'],
                'interview_available' => $payload['interview_available'],
                'current_status' => $payload['application']->stage->label(),
            ],
        ]);
    }

    public function studentFollowupPreference(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'preference' => ['required', Rule::enum(InterviewFollowupPreference::class)],
        ]);

        $application = $this->applications->forStudent($request->user());

        abort_unless(
            $application->interview_unlocked_at !== null,
            422,
            'Interview is not available yet.',
        );
        abort_unless(
            $application->interview_at === null,
            422,
            'A meeting is already scheduled. Finish or wait for that session first.',
        );
        abort_unless(
            $application->interview_meeting_ended_at !== null,
            422,
            'You can choose after an interview meeting has ended.',
        );

        $preference = InterviewFollowupPreference::from($validated['preference']);

        $application->forceFill([
            'interview_followup_preference' => $preference,
            'interview_followup_preference_at' => now(),
            'interview_status' => $preference === InterviewFollowupPreference::DeclineAnother
                ? InterviewStatus::Completed
                : InterviewStatus::NotScheduled,
        ])->save();

        if ($preference === InterviewFollowupPreference::WantAnother) {
            $this->notifications->notifyDepartments(
                [StaffDepartment::Interview],
                $request->user(),
                $request->user()->name.' wants another interview meeting. Please schedule the next session.',
                'interview_followup_requested',
                '/departments/interview',
            );
        } else {
            $this->notifications->notifyDepartments(
                [StaffDepartment::Interview],
                $request->user(),
                $request->user()->name.' does not want another interview meeting right now.',
                'interview_followup_declined',
                '/departments/interview',
            );
        }

        $payload = $this->applications->statusPayload($application->fresh());

        return response()->json([
            'data' => [
                'application' => StudentApplicationResource::make($payload['application'])->resolve(),
                'checklist' => $payload['checklist'],
                'preparation_available' => $payload['preparation_available'],
                'interview_available' => $payload['interview_available'],
                'current_status' => $payload['application']->stage->label(),
            ],
            'message' => $preference === InterviewFollowupPreference::WantAnother
                ? 'Thanks, preparation staff will schedule another meeting.'
                : 'Thanks, we noted that you do not want another meeting right now.',
        ]);
    }
}
