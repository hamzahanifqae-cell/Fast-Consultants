<?php

namespace App\Support\FormTemplates;

final class FormTemplateCatalog
{
    /**
     * @return list<array{
     *     key: string,
     *     title: string,
     *     letter_body: string,
     *     fields: list<array{key: string, label: string, type: string, required: bool}>
     * }>
     */
    public static function all(): array
    {
        return [
            SponsorshipLetter::definition(),
        ];
    }

    /**
     * @return array{
     *     key: string,
     *     title: string,
     *     letter_body: string,
     *     fields: list<array{key: string, label: string, type: string, required: bool}>
     * }|null
     */
    public static function find(string $key): ?array
    {
        foreach (self::all() as $template) {
            if ($template['key'] === $key) {
                return $template;
            }
        }

        return null;
    }

    public static function defaultKey(): string
    {
        return SponsorshipLetter::KEY;
    }
}
