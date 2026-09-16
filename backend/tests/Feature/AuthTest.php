<?php

namespace Tests\Feature;

use App\Enums\AccountApprovalStatus;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    public function test_a_student_can_register_and_waits_for_approval(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Sara Student',
            'email' => 'sara@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'account_type' => 'student',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.email', 'sara@example.com')
            ->assertJsonPath('user.roles.0', 'student')
            ->assertJsonPath('approval_status', 'pending')
            ->assertJsonMissingPath('token');

        $this->assertDatabaseHas('users', [
            'email' => 'sara@example.com',
            'account_approval_status' => AccountApprovalStatus::Pending->value,
        ]);
    }

    public function test_consultant_cannot_self_register(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Chris Consultant',
            'email' => 'chris@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'account_type' => 'consultant',
        ])->assertUnprocessable();
    }

    public function test_pending_student_cannot_login(): void
    {
        $user = User::factory()->student()->create([
            'email' => 'sara@example.com',
            'account_approval_status' => AccountApprovalStatus::Pending,
            'account_approved_at' => null,
        ]);

        $this->postJson('/api/login', [
            'email' => 'sara@example.com',
            'password' => 'password',
        ])
            ->assertForbidden()
            ->assertJsonPath('approval_status', 'pending');

        $this->assertNotNull($user);
    }

    public function test_rejected_student_cannot_login(): void
    {
        User::factory()->student()->create([
            'email' => 'sara@example.com',
            'account_approval_status' => AccountApprovalStatus::Rejected,
            'account_approved_at' => null,
            'account_rejection_reason' => 'Incomplete details',
        ]);

        $this->postJson('/api/login', [
            'email' => 'sara@example.com',
            'password' => 'password',
        ])
            ->assertForbidden()
            ->assertJsonPath('approval_status', 'rejected')
            ->assertJsonPath('rejection_reason', 'Incomplete details');
    }

    public function test_leads_staff_can_approve_pending_account(): void
    {
        $student = User::factory()->student()->create([
            'email' => 'sara@example.com',
            'account_approval_status' => AccountApprovalStatus::Pending,
            'account_approved_at' => null,
        ]);
        $staff = $this->makeLeadsStaff();

        Sanctum::actingAs($staff);

        $this->postJson("/api/consultant/account-requests/{$student->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.account_approval_status', 'approved');

        $this->assertDatabaseHas('users', [
            'id' => $student->id,
            'account_approval_status' => AccountApprovalStatus::Approved->value,
            'account_reviewed_by' => $staff->id,
        ]);

        $this->postJson('/api/login', [
            'email' => 'sara@example.com',
            'password' => 'password',
        ])->assertOk()->assertJsonStructure(['token', 'user']);
    }

    public function test_leads_staff_can_reject_pending_account(): void
    {
        $student = User::factory()->student()->create([
            'email' => 'sara@example.com',
            'account_approval_status' => AccountApprovalStatus::Pending,
            'account_approved_at' => null,
        ]);
        $staff = $this->makeLeadsStaff();

        Sanctum::actingAs($staff);

        $this->postJson("/api/consultant/account-requests/{$student->id}/reject", [
            'reason' => 'Please use the enquiry form first.',
        ])
            ->assertOk()
            ->assertJsonPath('data.account_approval_status', 'rejected');

        $this->postJson('/api/login', [
            'email' => 'sara@example.com',
            'password' => 'password',
        ])
            ->assertForbidden()
            ->assertJsonPath('approval_status', 'rejected');
    }

    public function test_a_user_can_login_and_view_their_profile(): void
    {
        $user = User::factory()->student()->create([
            'email' => 'sara@example.com',
        ]);

        $login = $this->postJson('/api/login', [
            'email' => 'sara@example.com',
            'password' => 'password',
        ]);

        $login->assertOk()->assertJsonStructure(['token', 'user']);

        $this->getJson('/api/me', [
            'Authorization' => 'Bearer '.$login->json('token'),
        ])
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.roles.0', 'student');
    }

    public function test_login_fails_with_invalid_credentials(): void
    {
        User::factory()->student()->create([
            'email' => 'sara@example.com',
        ]);

        $this->postJson('/api/login', [
            'email' => 'sara@example.com',
            'password' => 'wrong-password',
        ])->assertUnprocessable();
    }

    public function test_an_authenticated_user_can_logout(): void
    {
        $user = User::factory()->student()->create();
        $token = $user->createToken('mobile')->plainTextToken;

        $this->postJson('/api/logout', [], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_guests_cannot_view_the_profile(): void
    {
        $this->getJson('/api/me')->assertUnauthorized();
    }

    public function test_sanctum_acting_as_can_access_me(): void
    {
        $user = User::factory()->consultant()->create();

        Sanctum::actingAs($user);

        $this->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('user.email', $user->email);
    }

    private function makeLeadsStaff(): User
    {
        $user = User::factory()->create([
            'email' => 'leads@example.com',
            'password' => Hash::make('password'),
            'staff_department' => StaffDepartment::Leads,
        ]);
        $user->assignRole(Role::Staff);
        $user->syncPermissions(
            collect(StaffDepartment::Leads->defaultPermissions())->map->value->all(),
        );

        return $user->fresh();
    }
}
