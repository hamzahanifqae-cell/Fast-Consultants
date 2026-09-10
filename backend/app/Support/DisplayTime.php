<?php

namespace App\Support;

use Illuminate\Support\Carbon;

class DisplayTime
{
    public static function timezone(): string
    {
        return (string) config('app.display_timezone', 'Asia/Karachi');
    }

    public static function format(?Carbon $at, string $format = 'M j, Y \a\t g:i A'): ?string
    {
        if (! $at) {
            return null;
        }

        return $at->copy()->timezone(self::timezone())->format($format);
    }
}
