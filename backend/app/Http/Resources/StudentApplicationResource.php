<?php

namespace App\Http\Resources;

use App\Enums\InterviewFollowupPreference;
use App\Enums\InterviewStatus;
use App\Models\StudentApplication;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StudentApplication
 */
class StudentApplicationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'stage' => $this->stage->value,
            'stage_label' => $this->stage->label(),
            'everything_accepted' => $this->everything_accepted,
            'preparation' => [
                'title' => $this->preparation_title,
                'body' => $this->preparation_body,
                'unlocked_at' => $this->preparation_unlocked_at?->toIso8601String(),
                'completed_at' => $this->preparation_completed_at?->toIso8601String(),
            ],
            'interview' => [
                'status' => $this->interview_status->value,
                'status_label' => $this->interviewStatusLabel(),
                'at' => $this->interview_at?->toIso8601String(),
                'mode' => $this->interview_mode,
                'location' => $this->interview_location,
                'notes' => $this->interview_notes,
                'unlocked_at' => $this->interview_unlocked_at?->toIso8601String(),
                'followup_preference' => $this->interview_followup_preference?->value,
                'followup_preference_label' => $this->interview_followup_preference?->label(),
                'followup_preference_at' => $this->interview_followup_preference_at?->toIso8601String(),
                'meeting_ended_at' => $this->interview_meeting_ended_at?->toIso8601String(),
            ],
            'student' => $this->whenLoaded('student', fn () => [
                'id' => $this->student->id,
                'name' => $this->student->name,
                'email' => $this->student->email,
            ]),
            'consultant' => $this->whenLoaded('consultant', fn () => $this->consultant ? [
                'id' => $this->consultant->id,
                'name' => $this->consultant->name,
                'email' => $this->consultant->email,
            ] : null),
            'updated_at' => $this->updated_at?->toIso8601String(),
        ];
    }

    private function interviewStatusLabel(): string
    {
        if ($this->interview_status === InterviewStatus::Cancelled && $this->interview_at === null) {
            return InterviewStatus::Cancelled->label();
        }

        if ($this->interview_at !== null) {
            return InterviewStatus::Scheduled->label();
        }

        if ($this->interview_meeting_ended_at !== null) {
            return match ($this->interview_followup_preference) {
                InterviewFollowupPreference::DeclineAnother => 'Completed',
                InterviewFollowupPreference::WantAnother => 'Awaiting next schedule',
                default => 'Session completed',
            };
        }

        return $this->interview_status->label();
    }
}
