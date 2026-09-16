<?php

namespace App\Support;

/**
 * Maps notification type/action to a sidebar section key for unread badges.
 */
final class NotificationSection
{
    public const LEADS = 'leads';

    public const DOCUMENTS = 'documents';

    public const FORM_TEMPLATES = 'form_templates';

    public const UNIVERSITIES = 'universities';

    public const FINANCE = 'finance';

    public const INTERVIEW = 'interview';

    public const VISA = 'visa';

    public const STUDENT_INFO = 'student_info';

    public const MESSAGES = 'messages';

    public const STATUS = 'status';

    public const PROFILE = 'profile';

    /**
     * @return list<string>
     */
    public static function keys(): array
    {
        return [
            self::LEADS,
            self::DOCUMENTS,
            self::FORM_TEMPLATES,
            self::UNIVERSITIES,
            self::FINANCE,
            self::INTERVIEW,
            self::VISA,
            self::STUDENT_INFO,
            self::MESSAGES,
            self::STATUS,
            self::PROFILE,
        ];
    }

    public static function for(?string $type, ?string $action): ?string
    {
        $type = strtolower(trim((string) $type));
        $action = strtolower(trim((string) $action));

        if ($type === '' && $action === '') {
            return null;
        }

        if (
            str_starts_with($type, 'chat_')
            || $action === 'chat'
            || str_contains($action, '/messages')
            || str_contains($action, '/departments/messages')
        ) {
            return self::MESSAGES;
        }

        if (str_starts_with($type, 'lead_')
            || str_starts_with($type, 'account_registration')
            || str_contains($action, '/leads')
        ) {
            return self::LEADS;
        }

        if (
            str_starts_with($type, 'form_template')
            || str_contains($action, 'form-templates')
            || str_contains($action, 'form_templates')
        ) {
            return self::FORM_TEMPLATES;
        }

        if (
            str_starts_with($type, 'document_')
            || $type === 'urgent_documents_requested'
            || str_contains($action, '/documents')
            || str_contains($action, 'student-documents')
        ) {
            return self::DOCUMENTS;
        }

        if (
            str_contains($type, 'university')
            || $type === 'documents_approved'
            || str_contains($action, 'universit')
        ) {
            return self::UNIVERSITIES;
        }

        if (
            str_starts_with($type, 'charge_')
            || $type === 'universities_shared'
            || str_contains($action, '/finance')
            || str_contains($action, 'charge-receipt')
        ) {
            return self::FINANCE;
        }

        if (
            str_contains($type, 'interview')
            || str_contains($type, 'preparation')
            || $type === 'fees_cleared'
            || str_contains($action, 'interview')
            || str_contains($action, 'preparation')
        ) {
            return self::INTERVIEW;
        }

        if (
            str_contains($type, 'visa')
            || str_contains($action, '/visa')
            || str_contains($action, 'visa-appointment')
        ) {
            return self::VISA;
        }

        if (
            str_contains($action, 'student-info')
            || str_contains($action, '/consultant/students')
        ) {
            return self::STUDENT_INFO;
        }

        if (str_contains($action, 'student-status') || str_contains($action, '/status')) {
            return self::STATUS;
        }

        if (str_contains($action, 'student-profile') || str_contains($action, '/profile')) {
            return self::PROFILE;
        }

        return null;
    }
}
