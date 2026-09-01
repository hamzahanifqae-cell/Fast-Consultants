<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

    public function test_a_student_can_register(): void
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
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'roles']]);

        $this->assertDatabaseHas('users', ['email' => 'sara@example.com']);
    }

    public function test_a_consultant_can_register(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Chris Consultant',
            'email' => 'chris@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'account_type' => 'consultant',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.roles.0', 'consultant');
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
}
