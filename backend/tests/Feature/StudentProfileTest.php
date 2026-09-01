<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentProfileTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    /**
     * @return array<string, mixed>
     */
    private function completeProfilePayload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Sara Updated',
            'phone' => '+923001234567',
            'date_of_birth' => '2002-05-10',
            'gender' => 'female',
            'nationality' => 'Pakistani',
            'country_of_residence' => 'Pakistan',
            'city' => 'Lahore',
            'address' => '123 Main Street',
            'passport_number' => 'AB123456',
            'cnic_number' => '35202-1234567-1',
            'information_category' => 'education',
            'education_level' => "Bachelor's",
            'institution_name' => 'Punjab University',
            'field_of_study' => 'Business',
            'graduation_year' => '2024',
            'job_title' => 'Analyst',
            'employer_name' => 'Acme Corp',
            'years_of_experience' => '2',
            'other_information' => 'Interested in study abroad advising.',
        ], $overrides);
    }

    public function test_a_student_gets_a_profile_on_register(): void
    {
        $this->postJson('/api/register', [
            'name' => 'Sara Student',
            'email' => 'sara@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'account_type' => 'student',
        ])->assertCreated();

        $this->assertDatabaseHas('student_profiles', [
            'user_id' => User::query()->where('email', 'sara@example.com')->value('id'),
        ]);
    }

    public function test_a_student_can_view_and_update_personal_information(): void
    {
        $student = User::factory()->student()->create([
            'name' => 'Sara Student',
        ]);
        $student->studentProfile()->create();

        Sanctum::actingAs($student);

        $this->getJson('/api/student/profile')
            ->assertOk()
            ->assertJsonPath('data.name', 'Sara Student')
            ->assertJsonPath('data.email', $student->email);

        $this->putJson('/api/student/profile', $this->completeProfilePayload())
            ->assertOk()
            ->assertJsonPath('data.name', 'Sara Updated')
            ->assertJsonPath('data.phone', '+923001234567')
            ->assertJsonPath('data.gender', 'female')
            ->assertJsonPath('data.city', 'Lahore')
            ->assertJsonPath('data.cnic_number', '35202-1234567-1')
            ->assertJsonPath('data.information_category', 'education')
            ->assertJsonPath('data.institution_name', 'Punjab University')
            ->assertJsonPath('data.job_title', 'Analyst')
            ->assertJsonPath('data.other_information', 'Interested in study abroad advising.');

        $this->assertDatabaseHas('users', [
            'id' => $student->id,
            'name' => 'Sara Updated',
        ]);

        $this->assertDatabaseHas('student_profiles', [
            'user_id' => $student->id,
            'phone' => '+923001234567',
            'nationality' => 'Pakistani',
            'passport_number' => 'AB123456',
            'cnic_number' => '35202-1234567-1',
            'information_category' => 'education',
            'institution_name' => 'Punjab University',
            'job_title' => 'Analyst',
            'other_information' => 'Interested in study abroad advising.',
        ]);
    }

    public function test_student_profile_update_requires_all_fields(): void
    {
        $student = User::factory()->student()->create();
        $student->studentProfile()->create();

        Sanctum::actingAs($student);

        $this->putJson('/api/student/profile', [
            'name' => 'Sara Student',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'phone',
                'date_of_birth',
                'gender',
                'nationality',
                'country_of_residence',
                'city',
                'address',
                'passport_number',
                'cnic_number',
                'information_category',
                'education_level',
                'institution_name',
                'field_of_study',
                'graduation_year',
                'job_title',
                'employer_name',
                'years_of_experience',
                'other_information',
            ]);
    }

    public function test_education_job_and_other_fields_are_all_required(): void
    {
        $student = User::factory()->student()->create();
        $student->studentProfile()->create();

        Sanctum::actingAs($student);

        $this->putJson('/api/student/profile', $this->completeProfilePayload([
            'education_level' => null,
            'institution_name' => null,
            'field_of_study' => null,
            'graduation_year' => null,
            'job_title' => null,
            'employer_name' => null,
            'years_of_experience' => null,
            'other_information' => null,
        ]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'education_level',
                'institution_name',
                'field_of_study',
                'graduation_year',
                'job_title',
                'employer_name',
                'years_of_experience',
                'other_information',
            ]);
    }

    public function test_a_consultant_cannot_access_student_profile(): void
    {
        $consultant = User::factory()->consultant()->create();

        Sanctum::actingAs($consultant);

        $this->getJson('/api/student/profile')->assertForbidden();
        $this->putJson('/api/student/profile', [
            'phone' => '+923001234567',
        ])->assertForbidden();
    }

    public function test_guests_cannot_access_student_profile(): void
    {
        $this->getJson('/api/student/profile')->assertUnauthorized();
    }
}
