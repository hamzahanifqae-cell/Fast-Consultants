<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DepartmentAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    public function test_a_consultant_can_create_and_list_departments(): void
    {
        $consultant = User::factory()->consultant()->create();

        Sanctum::actingAs($consultant);

        $this->postJson('/api/departments', [
            'name' => 'Admissions',
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Admissions');

        $this->getJson('/api/departments')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Admissions');
    }

    public function test_a_student_cannot_access_departments(): void
    {
        $student = User::factory()->student()->create();

        Sanctum::actingAs($student);

        $this->getJson('/api/departments')->assertForbidden();
        $this->postJson('/api/departments', [
            'name' => 'Admissions',
        ])->assertForbidden();
    }

    public function test_guests_cannot_access_departments(): void
    {
        $this->getJson('/api/departments')->assertUnauthorized();
    }
}
