<?php

namespace App\Models;

use App\Enums\ApplicationStage;
use App\Enums\InterviewFollowupPreference;
use App\Enums\InterviewStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'student_id',
    'consultant_id',
    'stage',
    'everything_accepted',
    'preparation_title',
    'preparation_body',
    'preparation_unlocked_at',
    'preparation_completed_at',
    'interview_at',
    'interview_mode',
    'interview_location',
    'interview_notes',
    'interview_status',
    'interview_unlocked_at',
    'interview_reminder_1h_sent_at',
    'interview_reminder_15m_sent_at',
    'interview_starting_sent_at',
    'interview_student_joined_at',
    'interview_staff_joined_at',
    'interview_followup_preference',
    'interview_followup_preference_at',
    'interview_meeting_ended_at',
])]
class StudentApplication extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'stage' => ApplicationStage::class,
            'interview_status' => InterviewStatus::class,
            'interview_followup_preference' => InterviewFollowupPreference::class,
            'everything_accepted' => 'boolean',
            'preparation_unlocked_at' => 'datetime',
            'preparation_completed_at' => 'datetime',
            'interview_at' => 'datetime',
            'interview_unlocked_at' => 'datetime',
            'interview_reminder_1h_sent_at' => 'datetime',
            'interview_reminder_15m_sent_at' => 'datetime',
            'interview_starting_sent_at' => 'datetime',
            'interview_student_joined_at' => 'datetime',
            'interview_staff_joined_at' => 'datetime',
            'interview_followup_preference_at' => 'datetime',
            'interview_meeting_ended_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }
}
