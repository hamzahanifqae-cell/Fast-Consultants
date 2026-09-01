<?php

namespace App\Enums;

enum Permission: string
{
    case UniversitiesView = 'universities.view';
    case UniversitiesManage = 'universities.manage';

    case FinanceView = 'finance.view';
    case FinanceManage = 'finance.manage';

    case StudentInfoView = 'student_info.view';
    case StudentInfoManage = 'student_info.manage';

    case VisaView = 'visa.view';
    case VisaManage = 'visa.manage';

    case InterviewView = 'interview.view';
    case InterviewManage = 'interview.manage';

    case UsersView = 'users.view';
    case UsersManage = 'users.manage';
    case PermissionsAssign = 'permissions.assign';

    public function label(): string
    {
        return match ($this) {
            self::UniversitiesView => 'View universities',
            self::UniversitiesManage => 'Manage universities',
            self::FinanceView => 'View finance',
            self::FinanceManage => 'Manage finance',
            self::StudentInfoView => 'View student info',
            self::StudentInfoManage => 'Manage student info',
            self::VisaView => 'View visa',
            self::VisaManage => 'Manage visa',
            self::InterviewView => 'View interviews',
            self::InterviewManage => 'Manage interviews',
            self::UsersView => 'View organization users',
            self::UsersManage => 'Manage organization users',
            self::PermissionsAssign => 'Assign permissions',
        };
    }

    /**
     * @return list<self>
     */
    public static function assignableBySuperAdmin(): array
    {
        return array_values(array_filter(
            self::cases(),
            fn (self $permission) => ! in_array($permission, [
                self::UsersManage,
                self::PermissionsAssign,
            ], true),
        ));
    }
}
