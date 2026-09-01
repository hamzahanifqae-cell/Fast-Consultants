<?php

namespace Tests\Feature;

use App\Enums\ChargeReceiptStatus;
use App\Enums\DocumentStatus;
use App\Enums\InterviewStatus;
use App\Models\ChargeReceipt;
use App\Models\StudentApplication;
use App\Models\StudentDocument;
use App\Models\User;
use App\Models\UserNotification;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentApplicationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
    }

    public function test_preparation_unlocks_when_documents_and_charges_are_accepted(): void
    {
        $student = User::factory()->student()->create();
        $consultant = User::factory()->consultant()->create();

        StudentDocument::query()->create([
            'user_id' => $student->id,
            'type' => 'passport',
            'title' => 'Passport',
            'original_name' => 'passport.pdf',
            'file_path' => 'docs/passport.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 100,
            'status' => DocumentStatus::Approved,
        ]);

        ChargeReceipt::query()->create([
            'consultant_id' => $consultant->id,
            'student_id' => $student->id,
            'title' => 'Fee',
            'amount' => 1000,
            'currency' => 'PKR',
            'notes' => null,
            'consultant_original_name' => 'fee.pdf',
            'consultant_file_path' => 'fees/fee.pdf',
            'consultant_mime_type' => 'application/pdf',
            'consultant_file_size' => 100,
            'student_original_name' => 'paid.pdf',
            'student_file_path' => 'fees/paid.pdf',
            'student_mime_type' => 'application/pdf',
            'student_file_size' => 120,
            'status' => ChargeReceiptStatus::Approved,
        ]);

        Sanctum::actingAs($student);

        $this->getJson('/api/student/application-status')
            ->assertOk()
            ->assertJsonPath('data.application.everything_accepted', true)
            ->assertJsonPath('data.application.stage', 'preparation')
            ->assertJsonPath('data.preparation_available', true)
            ->assertJsonPath('data.current_status', 'Preparation');
    }

    public function test_consultant_can_unlock_interview_after_preparation(): void
    {
        $student = User::factory()->student()->create();
        $consultant = User::factory()->consultant()->create();

        StudentDocument::query()->create([
            'user_id' => $student->id,
            'type' => 'passport',
            'title' => 'Passport',
            'original_name' => 'passport.pdf',
            'file_path' => 'docs/passport.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 100,
            'status' => DocumentStatus::Approved,
        ]);

        ChargeReceipt::query()->create([
            'consultant_id' => $consultant->id,
            'student_id' => $student->id,
            'title' => 'Fee',
            'amount' => 1000,
            'currency' => 'PKR',
            'notes' => null,
            'consultant_original_name' => 'fee.pdf',
            'consultant_file_path' => 'fees/fee.pdf',
            'consultant_mime_type' => 'application/pdf',
            'consultant_file_size' => 100,
            'student_original_name' => 'paid.pdf',
            'student_file_path' => 'fees/paid.pdf',
            'student_mime_type' => 'application/pdf',
            'student_file_size' => 120,
            'status' => ChargeReceiptStatus::Approved,
        ]);

        Sanctum::actingAs($consultant);

        $this->putJson("/api/consultant/applications/{$student->id}", [
            'preparation_title' => 'Prep guide',
            'preparation_body' => 'Review your documents.',
            'unlock_interview' => true,
            'interview_at' => now()->addDays(3)->toIso8601String(),
            'interview_mode' => 'Online',
            'interview_location' => 'Zoom',
            'interview_notes' => 'Bring passport.',
        ])
            ->assertOk()
            ->assertJsonPath('data.application.stage', 'interview')
            ->assertJsonPath('data.interview_available', true)
            ->assertJsonPath('data.application.interview.status', 'scheduled');

        Sanctum::actingAs($student);

        $this->getJson('/api/student/application-status')
            ->assertOk()
            ->assertJsonPath('data.interview_available', true)
            ->assertJsonPath('data.current_status', 'Interview');
    }

    public function test_interview_reminder_command_notifies_student_before_session(): void
    {
        Carbon::setTestNow('2026-08-27 10:00:00');

        $student = User::factory()->student()->create();
        $consultant = User::factory()->consultant()->create();

        StudentApplication::query()->create([
            'student_id' => $student->id,
            'consultant_id' => $consultant->id,
            'stage' => 'interview',
            'everything_accepted' => true,
            'interview_at' => now()->addHour(),
            'interview_mode' => 'Online',
            'interview_location' => 'https://meet.google.com/demo',
            'interview_status' => InterviewStatus::Scheduled,
            'interview_unlocked_at' => now(),
        ]);

        $this->artisan('interview:send-reminders')->assertSuccessful();

        $this->assertDatabaseHas('user_notifications', [
            'user_id' => $student->id,
            'type' => 'interview_reminder',
            'action' => '/student-interview',
        ]);

        $notification = UserNotification::query()->where('user_id', $student->id)->first();
        $this->assertNotNull($notification);
        $this->assertStringContainsString('1 hour', $notification->message);

        Carbon::setTestNow();
    }
}
