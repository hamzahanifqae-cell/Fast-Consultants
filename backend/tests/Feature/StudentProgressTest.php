<?php

namespace Tests\Feature;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use App\Enums\Gender;
use App\Models\StudentDocument;
use App\Models\StudentProfile;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentProgressTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    public function test_consultant_can_list_student_journey_progress(): void
    {
        $consultant = User::factory()->consultant()->create();
        $student = User::factory()->student()->create([
            'name' => 'Amina Khan',
            'email' => 'amina@example.com',
        ]);

        StudentProfile::query()->create([
            'user_id' => $student->id,
            'phone' => '03001234567',
            'date_of_birth' => '2000-01-15',
            'gender' => Gender::Female,
            'nationality' => 'Pakistani',
            'country_of_residence' => 'Pakistan',
            'city' => 'Lahore',
            'address' => 'Model Town',
            'passport_number' => 'AB1234567',
            'cnic_number' => '35202-1234567-1',
            'education_level' => 'bachelors',
            'institution_name' => 'PU',
            'field_of_study' => 'CS',
            'graduation_year' => '2024',
            'job_title' => 'Engineer',
            'employer_name' => 'Acme',
            'years_of_experience' => '2',
            'other_information' => 'Ready to apply',
        ]);

        StudentDocument::query()->create([
            'user_id' => $student->id,
            'type' => DocumentType::Passport,
            'title' => 'Passport',
            'original_name' => 'passport.pdf',
            'file_path' => 'documents/passport.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1200,
            'status' => DocumentStatus::Approved,
        ]);

        Sanctum::actingAs($consultant);

        $response = $this->getJson('/api/consultant/students/progress');

        $response
            ->assertOk()
            ->assertJsonPath('data.0.id', $student->id)
            ->assertJsonPath('data.0.name', 'Amina Khan')
            ->assertJsonPath('data.0.sections.personal.complete', true)
            ->assertJsonPath('data.0.sections.documents.percent', 100)
            ->assertJsonStructure([
                'data' => [
                    [
                        'id',
                        'name',
                        'email',
                        'current_status',
                        'overall_percent',
                        'sections' => [
                            'personal' => ['percent', 'complete', 'report', 'meta'],
                            'documents' => ['percent', 'complete', 'report', 'meta'],
                            'universities' => ['percent', 'complete', 'report', 'meta'],
                            'fees' => ['percent', 'complete', 'report', 'meta'],
                            'interview' => ['percent', 'complete', 'report', 'meta'],
                            'visa' => ['percent', 'complete', 'report', 'meta'],
                            'status' => ['percent', 'complete', 'report', 'meta'],
                        ],
                    ],
                ],
            ]);
    }

    public function test_students_cannot_access_progress_directory(): void
    {
        $student = User::factory()->student()->create();

        Sanctum::actingAs($student);

        $this->getJson('/api/consultant/students/progress')->assertForbidden();
    }
}
