<?php

namespace Tests\Feature;

use App\Enums\ChargeReceiptStatus;
use App\Enums\DocumentStatus;
use App\Enums\InterviewStatus;
use App\Enums\Permission;
use App\Models\ChargeReceipt;
use App\Models\StudentApplication;
use App\Models\StudentDocument;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InterviewVideoTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
    }

    public function test_student_can_fetch_in_app_video_room_when_interview_unlocked(): void
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

        StudentApplication::query()->create([
            'student_id' => $student->id,
            'consultant_id' => $consultant->id,
            'stage' => 'interview',
            'everything_accepted' => true,
            'interview_mode' => 'Online',
            'interview_status' => InterviewStatus::Scheduled,
            'interview_at' => now()->addHour(),
            'interview_unlocked_at' => now(),
            'preparation_unlocked_at' => now(),
        ]);

        Sanctum::actingAs($student);

        $this->getJson('/api/student/interview/video-room')
            ->assertOk()
            ->assertJsonPath('data.provider', 'jitsi')
            ->assertJsonPath('data.room_name', 'EducationConsultant-Interview-'.$student->id)
            ->assertJsonPath('data.display_name', $student->name);
    }

    public function test_interview_staff_can_fetch_the_same_student_video_room(): void
    {
        $student = User::factory()->student()->create();
        $staff = User::factory()->consultant()->create();
        $staff->syncPermissions([
            Permission::InterviewView->value,
            Permission::InterviewManage->value,
        ]);

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
            'consultant_id' => $staff->id,
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

        StudentApplication::query()->create([
            'student_id' => $student->id,
            'consultant_id' => $staff->id,
            'stage' => 'interview',
            'everything_accepted' => true,
            'interview_mode' => 'Online',
            'interview_status' => InterviewStatus::Scheduled,
            'interview_at' => now()->addHour(),
            'interview_unlocked_at' => now(),
            'preparation_unlocked_at' => now(),
        ]);

        Sanctum::actingAs($staff);

        $this->getJson("/api/consultant/applications/{$student->id}/video-room")
            ->assertOk()
            ->assertJsonPath('data.room_name', 'EducationConsultant-Interview-'.$student->id)
            ->assertJsonPath('data.student_name', $student->name);
    }

    public function test_video_room_is_forbidden_before_interview_unlock(): void
    {
        $student = User::factory()->student()->create();

        StudentApplication::query()->create([
            'student_id' => $student->id,
            'stage' => 'preparation',
            'everything_accepted' => true,
            'interview_status' => InterviewStatus::NotScheduled,
        ]);

        Sanctum::actingAs($student);

        $this->getJson('/api/student/interview/video-room')->assertForbidden();
    }

    public function test_call_status_alarm_active_after_meeting_time_until_both_join(): void
    {
        [$student, $staff, $application] = $this->createUnlockedOnlineInterview();

        Sanctum::actingAs($student);

        $this->getJson('/api/student/interview/call-status')
            ->assertOk()
            ->assertJsonPath('data.alarm_active', true)
            ->assertJsonPath('data.student_joined', false)
            ->assertJsonPath('data.staff_joined', false)
            ->assertJsonPath('data.both_joined', false);

        $this->postJson('/api/student/interview/call/join')
            ->assertOk()
            ->assertJsonPath('data.student_joined', true)
            ->assertJsonPath('data.alarm_active', true);

        Sanctum::actingAs($staff);

        $this->getJson("/api/consultant/applications/{$student->id}/call-status")
            ->assertOk()
            ->assertJsonPath('data.alarm_active', true);

        $this->postJson("/api/consultant/applications/{$student->id}/call/join")
            ->assertOk()
            ->assertJsonPath('data.staff_joined', true)
            ->assertJsonPath('data.both_joined', true)
            ->assertJsonPath('data.alarm_active', false);

        Sanctum::actingAs($student);

        $this->getJson('/api/student/interview/call-status')
            ->assertOk()
            ->assertJsonPath('data.alarm_active', false)
            ->assertJsonPath('data.both_joined', true);
    }

    /**
     * @return array{0: User, 1: User, 2: StudentApplication}
     */
    private function createUnlockedOnlineInterview(): array
    {
        $student = User::factory()->student()->create();
        $staff = User::factory()->consultant()->create();
        $staff->syncPermissions([
            Permission::InterviewView->value,
            Permission::InterviewManage->value,
        ]);

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
            'consultant_id' => $staff->id,
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

        $application = StudentApplication::query()->create([
            'student_id' => $student->id,
            'consultant_id' => $staff->id,
            'stage' => 'interview',
            'everything_accepted' => true,
            'interview_mode' => 'Online',
            'interview_status' => InterviewStatus::Scheduled,
            'interview_at' => now()->subMinute(),
            'interview_unlocked_at' => now(),
            'preparation_unlocked_at' => now(),
        ]);

        return [$student, $staff, $application];
    }

    public function test_leaving_call_ends_meeting_until_staff_reschedules(): void
    {
        [$student, $staff, $application] = $this->createUnlockedOnlineInterview();

        Sanctum::actingAs($student);

        $this->postJson('/api/student/interview/call/join')->assertOk();
        $this->postJson('/api/student/interview/call/leave')
            ->assertOk()
            ->assertJsonPath('data.meeting_ended', true)
            ->assertJsonPath('data.call_status.interview_at', null);

        $application->refresh();
        $this->assertNull($application->interview_at);
        $this->assertNull($application->interview_student_joined_at);
        $this->assertNull($application->interview_staff_joined_at);

        $this->getJson('/api/student/interview/video-room')->assertForbidden();

        Sanctum::actingAs($staff);

        $this->putJson("/api/consultant/applications/{$student->id}", [
            'unlock_interview' => true,
            'interview_at' => now()->addHour()->toIso8601String(),
            'interview_mode' => 'Online',
        ])->assertOk();

        Sanctum::actingAs($student);

        $this->getJson('/api/student/interview/video-room')->assertOk();
    }

    public function test_student_can_request_or_decline_another_meeting_after_it_ends(): void
    {
        [$student, $staff, $application] = $this->createUnlockedOnlineInterview();

        Sanctum::actingAs($student);
        $this->postJson('/api/student/interview/call/leave')->assertOk();

        $this->getJson('/api/student/application-status')
            ->assertOk()
            ->assertJsonPath('data.application.interview.status_label', 'Session completed');

        $this->postJson('/api/student/interview/followup-preference', [
            'preference' => 'want_another',
        ])
            ->assertOk()
            ->assertJsonPath('data.application.interview.followup_preference', 'want_another')
            ->assertJsonPath('data.application.interview.status_label', 'Awaiting next schedule');

        $application->refresh();
        $this->assertSame('want_another', $application->interview_followup_preference?->value);

        Sanctum::actingAs($staff);
        $this->getJson("/api/consultant/applications/{$student->id}")
            ->assertOk()
            ->assertJsonPath('data.application.interview.followup_preference', 'want_another');

        $this->putJson("/api/consultant/applications/{$student->id}", [
            'unlock_interview' => true,
            'interview_at' => now()->addDay()->toIso8601String(),
            'interview_mode' => 'Online',
        ])->assertOk();

        $application->refresh();
        $this->assertNull($application->interview_followup_preference);
    }

    public function test_declining_another_meeting_marks_interview_completed(): void
    {
        [$student, , $application] = $this->createUnlockedOnlineInterview();

        Sanctum::actingAs($student);
        $this->postJson('/api/student/interview/call/leave')->assertOk();

        $this->postJson('/api/student/interview/followup-preference', [
            'preference' => 'decline_another',
        ])
            ->assertOk()
            ->assertJsonPath('data.application.interview.followup_preference', 'decline_another')
            ->assertJsonPath('data.application.interview.status_label', 'Completed');

        $application->refresh();
        $this->assertSame(InterviewStatus::Completed, $application->interview_status);
        $this->assertSame('decline_another', $application->interview_followup_preference?->value);
    }

    public function test_preparation_staff_can_cancel_scheduled_meeting(): void
    {
        [$student, $staff] = array_slice($this->createUnlockedOnlineInterview(), 0, 2);

        Sanctum::actingAs($staff);

        $this->postJson("/api/consultant/applications/{$student->id}/cancel-meeting")
            ->assertOk()
            ->assertJsonPath('data.meeting_cancelled', true)
            ->assertJsonPath('data.call_status.interview_at', null);

        $application = StudentApplication::query()->where('student_id', $student->id)->first();
        $this->assertNull($application->interview_at);
        $this->assertSame(InterviewStatus::Cancelled, $application->interview_status);

        Sanctum::actingAs($student);

        $this->getJson('/api/student/interview/video-room')->assertForbidden();
    }
}
