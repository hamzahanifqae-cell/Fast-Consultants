<?php

namespace App\Services;

use App\Enums\InterviewStatus;
use App\Models\StudentApplication;
use App\Models\User;

class InterviewVideoService
{
    public const PROVIDER = 'jitsi';

    public function roomNameForStudent(int $studentId): string
    {
        return 'EducationConsultant-Interview-'.$studentId;
    }

    public function joinUrl(string $roomName, string $displayName): string
    {
        $room = rawurlencode($roomName);
        $name = rawurlencode($displayName);

        return "https://meet.jit.si/{$room}#config.prejoinPageEnabled=true&config.disableDeepLinking=true&config.startWithAudioMuted=false&config.startWithVideoMuted=false&userInfo.displayName=\"{$name}\"";
    }

    /**
     * @return array{room_name: string, join_url: string, display_name: string, provider: string, student_name: string|null}
     */
    public function roomPayloadForStudent(User $student): array
    {
        $roomName = $this->roomNameForStudent($student->id);

        return [
            'room_name' => $roomName,
            'join_url' => $this->joinUrl($roomName, $student->name),
            'display_name' => $student->name,
            'provider' => self::PROVIDER,
            'student_name' => $student->name,
        ];
    }

    /**
     * @return array{room_name: string, join_url: string, display_name: string, provider: string, student_name: string|null}
     */
    public function roomPayloadForStaff(User $staff, User $student): array
    {
        $roomName = $this->roomNameForStudent($student->id);
        $label = trim($staff->name).' (Staff)';

        return [
            'room_name' => $roomName,
            'join_url' => $this->joinUrl($roomName, $label),
            'display_name' => $label,
            'provider' => self::PROVIDER,
            'student_name' => $student->name,
        ];
    }

    public function meetingActive(StudentApplication $application): bool
    {
        return $application->interview_unlocked_at !== null
            && $application->interview_at !== null;
    }

    public function interviewVideoAvailable(StudentApplication $application): bool
    {
        return $this->meetingActive($application);
    }

    public function markStudentJoined(StudentApplication $application): StudentApplication
    {
        if ($application->interview_student_joined_at === null) {
            $application->forceFill(['interview_student_joined_at' => now()])->save();
        }

        return $application->fresh();
    }

    public function markStaffJoined(StudentApplication $application): StudentApplication
    {
        if ($application->interview_staff_joined_at === null) {
            $application->forceFill(['interview_staff_joined_at' => now()])->save();
        }

        return $application->fresh();
    }

    /**
     * @return array{
     *     interview_at: string|null,
     *     student_joined: bool,
     *     staff_joined: bool,
     *     both_joined: bool,
     *     alarm_active: bool,
     *     seconds_until_start: int|null
     * }
     */
    public function callStatusPayload(StudentApplication $application): array
    {
        $interviewAt = $application->interview_at;
        $studentJoined = $application->interview_student_joined_at !== null;
        $staffJoined = $application->interview_staff_joined_at !== null;
        $bothJoined = $studentJoined && $staffJoined;

        $secondsUntilStart = null;
        $alarmActive = false;

        if ($interviewAt !== null) {
            $secondsUntilStart = $interviewAt->getTimestamp() - now()->getTimestamp();
            $alarmActive = $secondsUntilStart <= 0 && ! $bothJoined;
        }

        return [
            'interview_at' => $interviewAt?->toIso8601String(),
            'student_joined' => $studentJoined,
            'staff_joined' => $staffJoined,
            'both_joined' => $bothJoined,
            'alarm_active' => $alarmActive,
            'seconds_until_start' => $secondsUntilStart,
        ];
    }

    public function resetCallJoinState(StudentApplication $application): void
    {
        $application->forceFill([
            'interview_student_joined_at' => null,
            'interview_staff_joined_at' => null,
        ])->save();
    }

    public function endMeetingSession(StudentApplication $application, bool $cancelled = false): StudentApplication
    {
        if ($application->interview_at === null) {
            return $application;
        }

        $application->forceFill([
            'interview_at' => null,
            'interview_student_joined_at' => null,
            'interview_staff_joined_at' => null,
            'interview_reminder_1h_sent_at' => null,
            'interview_reminder_15m_sent_at' => null,
            'interview_starting_sent_at' => null,
            'interview_followup_preference' => null,
            'interview_followup_preference_at' => null,
            'interview_meeting_ended_at' => now(),
            'interview_status' => $cancelled
                ? InterviewStatus::Cancelled
                : InterviewStatus::NotScheduled,
        ])->save();

        return $application->fresh();
    }
}
