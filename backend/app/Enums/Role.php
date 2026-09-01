<?php

namespace App\Enums;

enum Role: string
{
    case Student = 'student';
    case SuperAdmin = 'super_admin';
    case Admin = 'admin';
    case Staff = 'staff';

    /** @deprecated Kept for mobile/API compatibility during migration */
    case Consultant = 'consultant';

    /**
     * @return list<self>
     */
    public static function organizationRoles(): array
    {
        return [
            self::SuperAdmin,
            self::Admin,
            self::Staff,
            self::Consultant,
        ];
    }

    public function isOrganization(): bool
    {
        return in_array($this, self::organizationRoles(), true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Student => 'Student',
            self::SuperAdmin => 'Super Admin',
            self::Admin => 'Admin',
            self::Staff => 'Staff',
            self::Consultant => 'Consultant',
        };
    }
}
