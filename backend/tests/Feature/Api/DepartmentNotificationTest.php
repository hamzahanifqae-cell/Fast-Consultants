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
