<?php

namespace App\Enums;

enum ApplicationStage: string
{
    case DocumentsAndCharges = 'documents_and_charges';
    case Preparation = 'preparation';
    case Interview = 'interview';
    case Completed = 'completed';

    public function label(): string
    {
        return match ($this) {
            self::DocumentsAndCharges => 'Documents & charges',
            self::Preparation => 'Preparation',
            self::Interview => 'Interview',
            self::Completed => 'Completed',
        };
    }
}
