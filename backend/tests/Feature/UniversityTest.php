<?php

namespace Tests\Feature;

use App\Models\University;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UniversityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    public function test_a_consultant_can_create_a_university_with_required_documents(): void
    {
        $consultant = User::factory()->consultant()->create();

        Sanctum::actingAs($consultant);

        $response = $this->postJson('/api/consultant/universities', [
            'name' => 'University of Toronto',
            'country' => 'Canada',
            'city' => 'Toronto',
            'description' => 'Strong for computer science.',
            'is_visible_to_students' => true,
            'required_documents' => ['passport', 'transcript', 'english_test'],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.name', 'University of Toronto')
            ->assertJsonCount(3, 'data.required_documents')
            ->assertJsonFragment(['type' => 'passport', 'label' => 'Passport'])
            ->assertJsonFragment(['type' => 'english_test', 'label' => 'IELTS score']);

        $this->assertDatabaseHas('universities', [
            'name' => 'University of Toronto',
            'consultant_id' => $consultant->id,
            'is_visible_to_students' => true,
        ]);
    }

    public function test_students_only_see_visible_universities_and_their_required_documents(): void
    {
        $consultant = User::factory()->consultant()->create();
        $student = User::factory()->student()->create();

        $visible = University::query()->create([
            'consultant_id' => $consultant->id,
            'name' => 'Visible Uni',
            'country' => 'UK',
            'city' => 'London',
            'description' => null,
            'is_visible_to_students' => true,
        ]);
        $visible->requiredDocuments()->create(['document_type' => 'passport']);
        $visible->requiredDocuments()->create(['document_type' => 'metric']);

        $hidden = University::query()->create([
            'consultant_id' => $consultant->id,
            'name' => 'Hidden Uni',
            'country' => 'USA',
            'city' => 'Boston',
            'description' => null,
            'is_visible_to_students' => false,
        ]);
        $hidden->requiredDocuments()->create(['document_type' => 'passport']);

        Sanctum::actingAs($student);

        $this->getJson('/api/student/universities')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Visible Uni')
            ->assertJsonCount(2, 'data.0.required_documents')
            ->assertJsonFragment(['type' => 'passport', 'label' => 'Passport'])
            ->assertJsonFragment(['type' => 'metric', 'label' => 'Metric (Matric)']);
    }

    public function test_a_student_cannot_create_universities(): void
    {
        $student = User::factory()->student()->create();

        Sanctum::actingAs($student);

        $this->postJson('/api/consultant/universities', [
            'name' => 'Should Fail',
            'country' => 'Canada',
            'required_documents' => ['passport'],
        ])->assertForbidden();
    }

    public function test_a_consultant_can_hide_a_university_from_students(): void
    {
        $consultant = User::factory()->consultant()->create();

        $university = University::query()->create([
            'consultant_id' => $consultant->id,
            'name' => 'Temp Uni',
            'country' => 'Germany',
            'city' => 'Berlin',
            'description' => null,
            'is_visible_to_students' => true,
        ]);
        $university->requiredDocuments()->create(['document_type' => 'passport']);

        Sanctum::actingAs($consultant);

        $this->putJson("/api/consultant/universities/{$university->id}", [
            'is_visible_to_students' => false,
        ])
            ->assertOk()
            ->assertJsonPath('data.is_visible_to_students', false);
    }
}
