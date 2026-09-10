<?php

namespace App\Enums;

enum LeadClassification: string
{
    case Interested = 'interested';
    case Future = 'future';
    case Ignore = 'ignore';

    public function label(): string
    {
        return match ($this) {
            self::Interested => 'Interested now',
            self::Future => 'For the future',
            self::Ignore => 'Ignore',
        };
    }
}
