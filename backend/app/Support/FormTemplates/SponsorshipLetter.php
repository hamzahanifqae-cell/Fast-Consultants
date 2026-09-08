<?php

namespace App\Support\FormTemplates;

final class SponsorshipLetter
{
    public const KEY = 'sponsorship_letter';

    /**
     * @return array{
     *     key: string,
     *     title: string,
     *     letter_body: string,
     *     fields: list<array{key: string, label: string, type: string, required: bool}>
     * }
     */
    public static function definition(): array
    {
        return [
            'key' => self::KEY,
            'title' => 'Sponsorship letter',
            'letter_body' => '',
            'fields' => [
                [
                    'key' => 'sponsor_full_name',
                    'label' => 'Sponsor full name',
                    'type' => 'text',
                    'required' => true,
                ],
                [
                    'key' => 'relationship',
                    'label' => 'Relationship to student',
                    'type' => 'text',
                    'required' => true,
                ],
                [
                    'key' => 'address',
                    'label' => 'Address',
                    'type' => 'textarea',
                    'required' => true,
                ],
                [
                    'key' => 'phone',
                    'label' => 'Phone',
                    'type' => 'text',
                    'required' => true,
                ],
                [
                    'key' => 'occupation_income',
                    'label' => 'Occupation / income',
                    'type' => 'text',
                    'required' => true,
                ],
                [
                    'key' => 'id_number',
                    'label' => 'Passport or CNIC number',
                    'type' => 'text',
                    'required' => true,
                ],
                [
                    'key' => 'declaration',
                    'label' => 'I declare the information above is true',
                    'type' => 'checkbox',
                    'required' => true,
                ],
            ],
        ];
    }

    /**
     * @return list<array{key: string, label: string, type: string, required: bool}>
     */
    public static function fields(): array
    {
        return self::definition()['fields'];
    }

    /**
     * @param  array<string, mixed>  $answers
     * @return array<string, string>
     */
    public static function validationErrors(array $answers): array
    {
        $errors = [];

        foreach (self::fields() as $field) {
            $key = $field['key'];
            $value = $answers[$key] ?? null;

            if (! $field['required']) {
                continue;
            }

            if ($field['type'] === 'checkbox') {
                if ($value !== true && $value !== 1 && $value !== '1' && $value !== 'true') {
                    $errors[$key] = $field['label'].' is required.';
                }
                continue;
            }

            if (! is_string($value) || trim($value) === '') {
                $errors[$key] = $field['label'].' is required.';
            }
        }

        return $errors;
    }

    /**
     * @param  array<string, mixed>  $answers
     * @return array<string, mixed>
     */
    public static function normalizeAnswers(array $answers): array
    {
        $normalized = [];

        foreach (self::fields() as $field) {
            $key = $field['key'];
            $value = $answers[$key] ?? null;

            if ($field['type'] === 'checkbox') {
                $normalized[$key] = $value === true || $value === 1 || $value === '1' || $value === 'true';
                continue;
            }

            $normalized[$key] = is_string($value) ? trim($value) : '';
        }

        return $normalized;
    }
}
