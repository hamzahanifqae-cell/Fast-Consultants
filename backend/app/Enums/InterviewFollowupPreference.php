<?php

namespace App\Enums;

enum InterviewFollowupPreference: string
{
    case WantAnother = 'want_another';
    case DeclineAnother = 'decline_another';

    public function label(): string
    {
        return match ($this) {
            self::WantAnother => 'Wants another meeting',
            self::DeclineAnother => 'Does not want another meeting',
        };
    }
}
