<?php

namespace App\Enums;

enum StaffDepartment: string
{
    case Universities = 'universities';
    case Finance = 'finance';
    case StudentInfo = 'student_info';
    case Visa = 'visa';
    case Interview = 'interview';
    case Leads = 'leads';

    public function label(): string
    {
        return match ($this) {
            self::Universities => 'Universities',
            self::Finance => 'Finance',
            self::StudentInfo => 'Student Info Collector',
            self::Visa => 'File Making',
            self::Interview => 'Interview',
            self::Leads => 'Leading',
        };
    }

    /**
     * Departments shown in the internal staff-to-staff directory.
     *
     * @return list<self>
     */
    public static function staffDirectoryDepartments(): array
    {
        return [
            self::StudentInfo,
            self::Universities,
            self::Finance,
            self::Leads,
            self::Interview,
            self::Visa,
        ];
    }

    public function viewPermission(): Permission
    {
        return match ($this) {
            self::Universities => Permission::UniversitiesView,
            self::Finance => Permission::FinanceView,
            self::StudentInfo => Permission::StudentInfoView,
            self::Visa => Permission::VisaView,
            self::Interview => Permission::InterviewView,
            self::Leads => Permission::LeadsView,
        };
    }

    public function managePermission(): Permission
    {
        return match ($this) {
            self::Universities => Permission::UniversitiesManage,
            self::Finance => Permission::FinanceManage,
            self::StudentInfo => Permission::StudentInfoManage,
            self::Visa => Permission::VisaManage,
            self::Interview => Permission::InterviewManage,
            self::Leads => Permission::LeadsManage,
        };
    }

    /**
     * Default permissions granted when a staff member is assigned this department.
     *
     * @return list<Permission>
     */
    public function defaultPermissions(): array
    {
        return match ($this) {
            self::Universities => [
                Permission::UniversitiesView,
                Permission::UniversitiesManage,
            ],
            self::Finance => [
                Permission::FinanceView,
                Permission::FinanceManage,
            ],
            self::StudentInfo => [
                Permission::StudentInfoView,
                Permission::StudentInfoManage,
            ],
            self::Visa => [
                Permission::VisaView,
                Permission::VisaManage,
            ],
            self::Interview => [
                Permission::InterviewView,
                Permission::InterviewManage,
            ],
            self::Leads => [
                Permission::LeadsView,
                Permission::LeadsManage,
            ],
        };
    }

    /** Whether students can open a chat with this department. */
    public function acceptsStudentChat(): bool
    {
        return true;
    }
}
