<?php

namespace App\Support;

final class StudyCountries
{
    /**
     * Popular study destinations students can choose from when suggesting universities.
     *
     * @return list<string>
     */
    public static function all(): array
    {
        return [
            'Australia',
            'Austria',
            'Belgium',
            'Canada',
            'China',
            'Cyprus',
            'Denmark',
            'Finland',
            'France',
            'Germany',
            'Hungary',
            'Ireland',
            'Italy',
            'Japan',
            'Malaysia',
            'Malta',
            'Netherlands',
            'New Zealand',
            'Norway',
            'Poland',
            'Portugal',
            'South Korea',
            'Spain',
            'Sweden',
            'Switzerland',
            'Turkey',
            'UAE',
            'UK',
            'USA',
        ];
    }
}
