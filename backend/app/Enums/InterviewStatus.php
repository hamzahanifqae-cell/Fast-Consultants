<?php

namespace App\Enums;

enum InterviewStatus: string
{
    case NotScheduled = 'not_scheduled';
    case Scheduled = 'scheduled';
    case Cancelled = 'cancelled';
    case Completed = 'completed';
    case Passed = 'passed';
    case Failed = 'failed';

    public function label(): string
    {
        return match ($this) {
            self::NotScheduled => 'Not scheduled',
            self::Scheduled => 'Scheduled',
            self::Cancelled => 'Cancelled',
            self::Completed => 'Completed',
            self::Passed => 'Passed',
            self::Failed => 'Failed',
        };
    }
}
