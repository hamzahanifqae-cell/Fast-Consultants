<?php

namespace App\Enums;

enum LeadStatus: string
{
    case New = 'new';
    case Classified = 'classified';
    case Converted = 'converted';
    case Dismissed = 'dismissed';

    public function label(): string
    {
        return match ($this) {
            self::New => 'New',
            self::Classified => 'Reviewed by model',
            self::Converted => 'Credentials created',
            self::Dismissed => 'Dismissed',
        };
    }
}
