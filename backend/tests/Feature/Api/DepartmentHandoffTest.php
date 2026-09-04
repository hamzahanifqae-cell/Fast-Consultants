<?php

namespace Tests\Feature\Api;

use App\Enums\ChargeReceiptStatus;
use App\Enums\DocumentStatus;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Models\ChargeReceipt;
use App\Models\StudentDocument;
use App\Models\University;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\PermissionRegistrar;
use Tests\TestCase;

class DepartmentHandoffTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RoleSeeder::class);
        Storage::fake('local');
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function test_approving_the_last_document_hands_the_student_to_universities(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $studentInfo = $this->makeStaff('info@example.com', StaffDepartment::StudentInfo);
        $universities = $this->makeStaff('unis@example.com', StaffDepartment::Universities);
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance);

        $passport = $this->makeDocument($student, 'passport', 'Passport');
        $cnic = $this->makeDocument($student, 'cnic', 'CNIC');

        Sanctum::actingAs($studentInfo);

        // One document still pending, so nothing is handed over yet.
        $this->patchJson("/api/consultant/documents/{$passport->id}/status", [
            'status' => 'approved',
        ])->assertOk();

        Sanctum::actingAs($universities);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonMissing(['type' => 'documents_approved']);

        Sanctum::actingAs($studentInfo);
        $this->patchJson("/api/consultant/documents/{$cnic->id}/status", [
            'status' => 'approved',
        ])->assertOk();

        Sanctum::actingAs($universities);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.type', 'documents_approved')
            ->assertJsonPath('data.0.action', '/departments/universities')
            ->assertJsonPath(
                'data.0.message',
                "Sara's documents are all approved. Share university options with them.",
            );

        // Finance is not part of this step.
        Sanctum::actingAs($finance);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonMissing(['type' => 'documents_approved']);
    }

    public function test_the_handoff_is_only_announced_once_per_milestone(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $studentInfo = $this->makeStaff('info@example.com', StaffDepartment::StudentInfo);
        $universities = $this->makeStaff('unis@example.com', StaffDepartment::Universities);

        $passport = $this->makeDocument($student, 'passport', 'Passport');
        $cnic = $this->makeDocument($student, 'cnic', 'CNIC');

        Sanctum::actingAs($studentInfo);
        $this->patchJson("/api/consultant/documents/{$passport->id}/status", ['status' => 'approved'])
            ->assertOk();
        $this->patchJson("/api/consultant/documents/{$cnic->id}/status", ['status' => 'approved'])
            ->assertOk();

        Sanctum::actingAs($universities);
        $this->assertSame(1, $this->countNotifications('documents_approved'));

        // A new document to review rolls the milestone back, and clearing it announces again.
        Sanctum::actingAs($student);
        $this->post('/api/student/documents', [
            'type' => 'transcript',
            'title' => 'Transcript',
            'file' => UploadedFile::fake()->create('transcript.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();

        $transcriptId = StudentDocument::query()
            ->where('user_id', $student->id)
            ->where('type', 'transcript')
            ->value('id');

        Sanctum::actingAs($studentInfo);
        $this->patchJson("/api/consultant/documents/{$transcriptId}/status", ['status' => 'approved'])
            ->assertOk();

        Sanctum::actingAs($universities);
        $this->assertSame(2, $this->countNotifications('documents_approved'));
    }

    public function test_sharing_a_university_hands_the_student_to_finance(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $universities = $this->makeStaff('unis@example.com', StaffDepartment::Universities);
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance);

        $this->approveAllDocuments($student);

        $university = University::query()->create([
            'consultant_id' => $universities->id,
            'name' => 'Test University',
            'country' => 'Canada',
            'city' => 'Toronto',
            'is_visible_to_students' => true,
        ]);

        Sanctum::actingAs($universities);
        $this->postJson("/api/consultant/students/{$student->id}/universities", [
            'university_id' => $university->id,
        ])->assertCreated();

        Sanctum::actingAs($finance);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.type', 'universities_shared')
            ->assertJsonPath('data.0.action', '/departments/finance')
            ->assertJsonPath('data.0.message', 'Sara has university options shared. Set up their charges.');

        $this->assertSame(1, $this->countNotifications('universities_shared'));
    }

    public function test_approving_the_last_charge_slip_hands_the_student_to_interview(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance);
        $interview = $this->makeStaff('interview@example.com', StaffDepartment::Interview);

        $receipt = ChargeReceipt::query()->create([
            'consultant_id' => $finance->id,
            'student_id' => $student->id,
            'title' => 'Application fee',
            'amount' => 1000,
            'currency' => 'PKR',
            'consultant_original_name' => 'charge.pdf',
            'consultant_file_path' => 'charge-receipts/consultant/charge.pdf',
            'consultant_mime_type' => 'application/pdf',
            'consultant_file_size' => 1000,
            'student_original_name' => 'slip.pdf',
            'student_file_path' => 'charge-receipts/student/slip.pdf',
            'student_mime_type' => 'application/pdf',
            'student_file_size' => 900,
            'status' => ChargeReceiptStatus::AwaitingReview,
        ]);

        Sanctum::actingAs($interview);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonMissing(['type' => 'fees_cleared']);

        Sanctum::actingAs($finance);
        $this->patchJson("/api/consultant/charge-receipts/{$receipt->id}/status", [
            'status' => 'approved',
        ])->assertOk();

        Sanctum::actingAs($interview);
        $this->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('data.0.type', 'fees_cleared')
            ->assertJsonPath('data.0.action', '/departments/interview')
            ->assertJsonPath(
                'data.0.message',
                "Sara's charges are fully paid and approved. Schedule their interview.",
            );
    }

    public function test_the_chain_blocks_a_department_that_jumps_ahead(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $universities = $this->makeStaff('unis@example.com', StaffDepartment::Universities);
        $finance = $this->makeStaff('finance@example.com', StaffDepartment::Finance);
        $interview = $this->makeStaff('interview@example.com', StaffDepartment::Interview);

        $university = University::query()->create([
            'consultant_id' => $universities->id,
            'name' => 'Test University',
            'country' => 'Canada',
            'city' => 'Toronto',
            'is_visible_to_students' => true,
        ]);

        $this->makeDocument($student, 'passport', 'Passport');

        // Universities cannot share while a document is still under review.
        Sanctum::actingAs($universities);
        $this->postJson("/api/consultant/students/{$student->id}/universities", [
            'university_id' => $university->id,
        ])->assertStatus(422);

        // Finance cannot raise charges before a university is shared.
        Sanctum::actingAs($finance);
        $this->post('/api/consultant/charge-receipts', [
            'student_id' => $student->id,
            'title' => 'Application fee',
            'amount' => 1000,
            'file' => UploadedFile::fake()->create('charge.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(422);

        // Interview cannot schedule before the charges are cleared.
        Sanctum::actingAs($interview);
        $this->putJson("/api/consultant/applications/{$student->id}", [
            'unlock_interview' => true,
        ])->assertStatus(422);

        // The same state is published so each page can explain the block.
        $this->getJson("/api/consultant/applications/{$student->id}")
            ->assertOk()
            ->assertJsonPath('data.handoff.documents_approved', false)
            ->assertJsonPath('data.handoff.universities_shared', false)
            ->assertJsonPath('data.handoff.fees_cleared', false);
    }

    public function test_staff_cannot_act_outside_their_department(): void
    {
        $student = User::factory()->student()->create(['name' => 'Sara']);
        $universities = $this->makeStaff('unis@example.com', StaffDepartment::Universities);
        $interview = $this->makeStaff('interview@example.com', StaffDepartment::Interview);

        $this->approveAllDocuments($student);

        $university = University::query()->create([
            'consultant_id' => $universities->id,
            'name' => 'Test University',
            'country' => 'Canada',
            'city' => 'Toronto',
            'is_visible_to_students' => true,
        ]);

        // Interview staff may not share universities or manage charges.
        Sanctum::actingAs($interview);
        $this->postJson("/api/consultant/students/{$student->id}/universities", [
            'university_id' => $university->id,
        ])->assertForbidden();
        $this->getJson('/api/consultant/charge-receipts')->assertForbidden();

        // Universities staff may not schedule interviews.
        Sanctum::actingAs($universities);
        $this->putJson("/api/consultant/applications/{$student->id}", [
            'preparation_title' => 'Nope',
        ])->assertForbidden();
    }

    private function approveAllDocuments(User $student): void
    {
        $document = $this->makeDocument($student, 'passport', 'Passport');
        $studentInfo = $this->makeStaff('info-approver@example.com', StaffDepartment::StudentInfo);

        Sanctum::actingAs($studentInfo);
        $this->patchJson("/api/consultant/documents/{$document->id}/status", ['status' => 'approved'])
            ->assertOk();
    }

    private function countNotifications(string $type): int
    {
        return collect($this->getJson('/api/notifications')->assertOk()->json('data'))
            ->where('type', $type)
            ->count();
    }

    private function makeDocument(User $student, string $type, string $title): StudentDocument
    {
        Storage::disk('local')->put("student-documents/{$student->id}/{$type}.pdf", $type);

        return StudentDocument::query()->create([
            'user_id' => $student->id,
            'type' => $type,
            'title' => $title,
            'original_name' => "{$type}.pdf",
            'file_path' => "student-documents/{$student->id}/{$type}.pdf",
            'mime_type' => 'application/pdf',
            'file_size' => 1000,
            'status' => DocumentStatus::Pending,
        ]);
    }

    private function makeStaff(string $email, StaffDepartment $department): User
    {
        $user = User::factory()->create([
            'email' => $email,
            'staff_department' => $department,
        ]);
        $user->assignRole(Role::Staff);
        $user->syncPermissions(
            collect($department->defaultPermissions())->map->value->all(),
        );

        return $user->fresh();
    }
}
