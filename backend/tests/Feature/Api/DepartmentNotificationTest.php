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
            ->assertJsonPath('data.0.message', 'Sara uploaded a document for review: Passport.');

        Sanctum::actingAs($universities);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 0)
            ->assertJsonCount(0, 'data');
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
