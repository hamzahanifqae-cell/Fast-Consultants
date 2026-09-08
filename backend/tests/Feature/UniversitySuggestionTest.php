<?php

namespace Tests\Feature;

use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Models\UniversitySuggestion;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UniversitySuggestionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    public function test_student_can_suggest_any_university_by_country_for_staff_review(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $staff = $this->makeUniversitiesStaff();

        Sanctum::actingAs($student);

        $this->getJson('/api/student/universities/countries')
            ->assertOk()
            ->assertJsonFragment(['Canada']);

        $this->postJson('/api/student/university-suggestions', [
            'country' => 'Canada',
            'universities' => [
                ['name' => 'University of Waterloo', 'city' => 'Waterloo'],
                ['name' => 'McGill University', 'city' => 'Montreal'],
            ],
        ])
            ->assertCreated()
            ->assertJsonPath('added', 2)
            ->assertJsonCount(2, 'data');

        $this->assertDatabaseCount('university_suggestions', 2);

        Sanctum::actingAs($staff);

        $list = $this->getJson('/api/consultant/university-suggestions?status=pending')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $suggestionId = $list->json('data.0.id');

        $this->postJson("/api/consultant/university-suggestions/{$suggestionId}/accept", [
            'required_documents' => ['passport', 'transcript'],
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted');

        $this->assertDatabaseHas('universities', [
            'name' => $list->json('data.0.name'),
            'country' => 'Canada',
        ]);

        $this->assertDatabaseHas('student_university', [
            'student_id' => $student->id,
            'source' => 'student_selected',
        ]);

        $this->assertDatabaseHas('university_required_documents', [
            'document_type' => 'passport',
        ]);
        $this->assertDatabaseHas('university_required_documents', [
            'document_type' => 'transcript',
        ]);

        Sanctum::actingAs($student);
        $this->getJson('/api/student/universities')
            ->assertOk()
            ->assertJsonCount(1, 'data');

        $universityId = $this->getJson('/api/student/universities')->json('data.0.id');

        Sanctum::actingAs($staff);
        $this->deleteJson("/api/consultant/students/{$student->id}/universities/{$universityId}")
            ->assertOk();

        $this->assertDatabaseMissing('student_university', [
            'student_id' => $student->id,
            'university_id' => $universityId,
        ]);

        Sanctum::actingAs($student);
        $this->getJson('/api/student/university-suggestions')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonMissing(['status' => 'accepted']);
    }

    private function makeUniversitiesStaff(): User
    {
        $user = User::factory()->create([
            'email' => 'unis@example.com',
            'staff_department' => StaffDepartment::Universities,
        ]);
        $user->assignRole(Role::Staff);
        $user->syncPermissions(
            collect(StaffDepartment::Universities->defaultPermissions())->map->value->all(),
        );

        return $user->fresh();
    }
}
