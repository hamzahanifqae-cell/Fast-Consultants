<?php

namespace Tests\Feature\Api;

use App\Enums\Permission;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class OrganizationRbacTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_public_register_is_student_only(): void
    {
        $this->postJson('/api/register', [
            'name' => 'New Admin',
            'email' => 'new-admin@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'account_type' => 'admin',
        ])->assertStatus(422);

        $this->postJson('/api/register', [
            'name' => 'New Student',
            'email' => 'new-student@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'account_type' => 'student',
        ])->assertCreated()
            ->assertJsonPath('user.roles.0', 'student');
    }

    public function test_admin_cannot_see_super_admin_in_team_list(): void
    {
        $super = $this->makeUser('super@example.com', Role::SuperAdmin, Permission::cases());
        $admin = $this->makeUser('admin@example.com', Role::Admin, [
            Permission::UsersView,
            Permission::StudentInfoView,
        ]);

        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/organization/users')->assertOk();
        $emails = collect($response->json('data'))->pluck('email');

        $this->assertFalse($emails->contains($super->email));
        $this->assertTrue($emails->contains($admin->email));
    }

    public function test_super_admin_can_create_staff_with_department_permissions(): void
    {
        $super = $this->makeUser('super@example.com', Role::SuperAdmin, Permission::cases());
        Sanctum::actingAs($super);

        $this->postJson('/api/organization/users', [
            'name' => 'Visa Staff',
            'email' => 'visa-staff@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => 'staff',
            'staff_department' => StaffDepartment::Visa->value,
            'permissions' => [
                Permission::VisaView->value,
                Permission::VisaManage->value,
            ],
        ])->assertCreated()
            ->assertJsonPath('data.roles.0', 'staff')
            ->assertJsonPath('data.staff_department', 'visa');

        $staff = User::query()->where('email', 'visa-staff@example.com')->firstOrFail();
        $this->assertTrue($staff->can(Permission::VisaView->value));
        $this->assertFalse($staff->can(Permission::FinanceView->value));
    }

    public function test_staff_cannot_create_organization_users(): void
    {
        $staff = $this->makeUser('staff@example.com', Role::Staff, [
            Permission::VisaView,
        ], StaffDepartment::Visa);

        Sanctum::actingAs($staff);

        $this->postJson('/api/organization/users', [
            'name' => 'Hacker',
            'email' => 'hacker@example.com',
            'password' => 'password',
            'password_confirmation' => 'password',
            'role' => 'admin',
        ])->assertForbidden();
    }

    /**
     * @param  list<Permission>  $permissions
     */
    private function makeUser(
        string $email,
        Role $role,
        array $permissions,
        ?StaffDepartment $department = null,
    ): User {
        $user = User::factory()->create([
            'email' => $email,
            'staff_department' => $department,
        ]);
        $user->assignRole($role);
        $user->syncPermissions(collect($permissions)->map->value->all());

        return $user;
    }
}
