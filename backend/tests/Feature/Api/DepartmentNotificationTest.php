<?php

namespace Tests\Feature\Api;

use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Models\User;
use App\Services\StudentNotificationService;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class DepartmentNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_department_notifications_only_reach_matching_roles(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance);
        $visa = $this->makeStaff('visa@example.com', StaffDepartment::Visa);
        $admin = User::factory()->create(['email' => 'admin@example.com']);
        $admin->assignRole(Role::Admin);
        $admin->syncPermissions(
            collect(\App\Enums\Permission::assignableBySuperAdmin())->map->value->all(),
        );

        app(StudentNotificationService::class)->notifyDepartment(
            StaffDepartment::Finance,
            $student,
            'Sara uploaded a payment slip.',
            'charge_receipt_uploaded',
            '/departments/finance',
        );

        Sanctum::actingAs($finance);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('data.0.message', 'Sara uploaded a payment slip.');

        Sanctum::actingAs($visa);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'data');

        Sanctum::actingAs($admin->fresh());
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'data');
    }

    public function test_document_upload_notifies_student_info_not_universities(): void
    {
        $studentInfo = $this->makeStaff('info@example.com', StaffDepartment::StudentInfo);
        $universities = $this->makeStaff('unis@example.com', StaffDepartment::Universities);
        $student = User::factory()->student()->create(['name' => 'Sara']);

        app(StudentNotificationService::class)->notifyDepartment(
            StaffDepartment::StudentInfo,
            $student,
            'Sara uploaded a document for review: Passport.',
            'document_uploaded',
            '/departments/documents',
        );

        Sanctum::actingAs($studentInfo);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('data.0.message', 'Sara uploaded a document for review: Passport.')
            ->assertJsonPath('unread_by_section.documents', 1)
            ->assertJsonPath('unread_by_section.leads', 0);

        Sanctum::actingAs($universities);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'data');
    }

    public function test_mark_read_can_clear_one_section_only(): void
    {
        $staff = $this->makeStaff('info@example.com', StaffDepartment::StudentInfo);
        $student = User::factory()->student()->create(['name' => 'Sara']);

        app(StudentNotificationService::class)->notifyDepartment(
            StaffDepartment::StudentInfo,
            $student,
            'Sara uploaded a document for review: Passport.',
            'document_uploaded',
            '/departments/documents',
            null,
            'document:1',
        );
        app(StudentNotificationService::class)->createForUser(
            $staff,
            $student,
            'Sara submitted a Sponsorship letter for review.',
            'form_template_submitted',
            '/departments/form-templates',
            null,
            'form_template:1',
        );

        Sanctum::actingAs($staff);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 2)
            ->assertJsonPath('unread_by_section.documents', 1)
            ->assertJsonPath('unread_by_section.form_templates', 1);

        $this->patchJson('/api/notifications/mark-read', ['section' => 'documents'])
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('unread_by_section.documents', 0)
            ->assertJsonPath('unread_by_section.form_templates', 1);
    }

    public function test_lead_submit_and_classify_count_as_one_badge(): void
    {
        $leads = $this->makeStaff('leads@example.com', StaffDepartment::Leads);
        $student = User::factory()->student()->create(['name' => 'Sara']);

        app(StudentNotificationService::class)->notifyDepartment(
            StaffDepartment::Leads,
            $student,
            'New lead form from Sara (sara@example.com). Classification is running.',
            'lead_submitted',
            '/departments/leads',
            null,
            'lead:42',
        );
        app(StudentNotificationService::class)->notifyDepartment(
            StaffDepartment::Leads,
            $student,
            'Lead scored as Interested now: Sara (sara@example.com). Score 88/100.',
            'lead_classified',
            '/departments/leads',
            null,
            'lead:42',
            true,
        );

        Sanctum::actingAs($leads);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonPath('unread_by_section.leads', 1)
            ->assertJsonPath('data.0.type', 'lead_classified');
    }

    private function makeStaff(string $email, StaffDepartment $department): User
    {
        $user = User::factory()->create([
            'email' => $email,
            'staff_department' => $department,
        ]);
        $user->assignRole(Role::Staff);
        $user->syncPermissions(
            collect($department->defaultPermissions())->map->value->all(),
        );

        return $user->fresh();
    }
}
