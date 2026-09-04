<?php

namespace App\Enums;

enum DocumentType: string
{
    case Passport = 'passport';
    case Cnic = 'cnic';
    case Metric = 'metric';
    case Intermediate = 'intermediate';
    case Transcript = 'transcript';
    case DegreeCertificate = 'degree_certificate';
    case Diploma = 'diploma';
    case EnglishTest = 'english_test';
    case RecommendationLetter = 'recommendation_letter';
    case Other = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Passport => 'Passport',
            self::Cnic => 'CNIC',
            self::Metric => 'Metric (Matric)',
            self::Intermediate => 'Intermediate',
            self::Transcript => 'Transcript',
            self::DegreeCertificate => 'Degree certificate',
            self::Diploma => 'Diploma',
            self::EnglishTest => 'IELTS score',
            self::RecommendationLetter => 'Recommendation letter',
            self::Other => 'Other',
        };
    }

    /**
     * Catch-all types may hold several files; every other type is one file per student,
     * edited in place when it gets rejected.
     */
    public function allowsMultiple(): bool
    {
        return $this === self::Other;
    }
}
