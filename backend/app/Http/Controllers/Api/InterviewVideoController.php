<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\InterviewVideoService;
use App\Services\StudentApplicationService;
use App\Services\StudentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InterviewVideoController extends Controller
{
    public function __construct(
        private readonly StudentApplicationService $applications,
        private readonly InterviewVideoService $video,
        private readonly StudentNotificationService $notifications,
    ) {
    }

    public function studentRoom(Request $request): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->isStudent(), 403);

        $application = $this->applications->forStudent($student);
        abort_unless($this->video->interviewVideoAvailable($application), 403, 'Interview video is not unlocked yet.');

        return response()->json([
            'data' => $this->video->roomPayloadForStudent($student),
        ]);
    }

    public function studentCallStatus(Request $request): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->isStudent(), 403);

        $application = $this->applications->forStudent($student);
        abort_unless($this->video->interviewVideoAvailable($application), 403, 'Interview video is not unlocked yet.');

        return response()->json([
            'data' => $this->video->callStatusPayload($application),
        ]);
    }

    public function studentJoinCall(Request $request): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->isStudent(), 403);

        $application = $this->applications->forStudent($student);
        abort_unless($this->video->interviewVideoAvailable($application), 403, 'Interview video is not unlocked yet.');

        $application = $this->video->markStudentJoined($application);

        return response()->json([
            'data' => $this->video->callStatusPayload($application),
        ]);
    }

    public function studentLeaveCall(Request $request): JsonResponse
    {
        $student = $request->user();
        abort_unless($student->isStudent(), 403);

        $application = $this->applications->forStudent($student);
        abort_unless($application->interview_unlocked_at !== null, 403, 'Interview is not unlocked yet.');

        if ($this->video->meetingActive($application)) {
            $application = $this->video->endMeetingSession($application);
            $this->notifyMeetingEnded($student, $request->user());
        }

        return response()->json([
            'data' => [
                'meeting_ended' => true,
                'call_status' => $this->video->callStatusPayload($application),
            ],
        ]);
    }

    public function consultantRoom(Request $request, User $student): JsonResponse
    {
        $this->assertCanAccessInterviewVideo($request);
        abort_unless($student->isStudent(), 404);

        $application = $this->applications->forStudent($student);
        abort_unless($this->video->interviewVideoAvailable($application), 403, 'Unlock interview for this student first.');

        return response()->json([
            'data' => $this->video->roomPayloadForStaff($request->user(), $student),
        ]);
    }

    public function consultantCallStatus(Request $request, User $student): JsonResponse
    {
        $this->assertCanAccessInterviewVideo($request);
        abort_unless($student->isStudent(), 404);

        $application = $this->applications->forStudent($student);
        abort_unless($this->video->interviewVideoAvailable($application), 403, 'Unlock interview for this student first.');

        return response()->json([
            'data' => $this->video->callStatusPayload($application),
        ]);
    }

    public function consultantJoinCall(Request $request, User $student): JsonResponse
    {
        $this->assertCanAccessInterviewVideo($request);
        abort_unless($student->isStudent(), 404);

        $application = $this->applications->forStudent($student);
        abort_unless($this->video->interviewVideoAvailable($application), 403, 'Unlock interview for this student first.');

        $application = $this->video->markStaffJoined($application);

        return response()->json([
            'data' => $this->video->callStatusPayload($application),
        ]);
    }

    public function consultantLeaveCall(Request $request, User $student): JsonResponse
    {
        $this->assertCanAccessInterviewVideo($request);
        abort_unless($student->isStudent(), 404);

        $application = $this->applications->forStudent($student);
        abort_unless($application->interview_unlocked_at !== null, 403, 'Unlock interview for this student first.');

        if ($this->video->meetingActive($application)) {
            $application = $this->video->endMeetingSession($application);
            $this->notifyMeetingEnded($student, $request->user());
        }

        return response()->json([
            'data' => [
                'meeting_ended' => true,
                'call_status' => $this->video->callStatusPayload($application),
            ],
        ]);
    }

    public function consultantCancelMeeting(Request $request, User $student): JsonResponse
    {
        $this->assertCanAccessInterviewVideo($request);
        abort_unless($student->isStudent(), 404);

        $application = $this->applications->forStudent($student);
        abort_unless($application->interview_unlocked_at !== null, 403, 'Unlock interview for this student first.');

        $cancelled = false;
        if ($this->video->meetingActive($application)) {
            $application = $this->video->endMeetingSession($application, cancelled: true);
            $this->notifyMeetingCancelled($student, $request->user());
            $cancelled = true;
        }

        return response()->json([
            'data' => [
                'meeting_cancelled' => $cancelled,
                'call_status' => $this->video->callStatusPayload($application),
            ],
        ]);
    }

    private function assertCanAccessInterviewVideo(Request $request): void
    {
        $user = $request->user();

        abort_unless(
            $user
                && (
                    $user->hasAppPermission(Permission::InterviewView)
                    || $user->hasAppPermission(Permission::InterviewManage)
                ),
            403,
            'Only Interview staff and Super Admin can join student video sessions.',
        );
    }

    private function notifyMeetingEnded(User $student, User $endedBy): void
    {
        $this->notifications->createForStudent(
            $student,
            $endedBy,
            'The interview meeting ended. Open Interview and choose whether you want another meeting.',
            'interview_meeting_ended',
            '/student-interview',
        );
    }

    private function notifyMeetingCancelled(User $student, User $cancelledBy): void
    {
        $this->notifications->createForStudent(
            $student,
            $cancelledBy,
            'Your interview meeting was cancelled. Preparation staff will schedule a new session.',
            'interview_meeting_cancelled',
            '/student-interview',
        );
    }
}
