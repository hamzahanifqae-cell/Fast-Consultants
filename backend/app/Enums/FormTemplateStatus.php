<?php

namespace App\Enums;

enum FormTemplateStatus: string
{
    case AwaitingStudent = 'awaiting_student';
    case AwaitingReview = 'awaiting_review';
    case Approved = 'approved';
    case Rejected = 'rejected';

    public function label(): string
    {
        return match ($this) {
            self::AwaitingStudent => 'Awaiting student upload',
            self::AwaitingReview => 'Awaiting staff review',
            self::Approved => 'Approved',
            self::Rejected => 'Rejected',
        };
    }
}
