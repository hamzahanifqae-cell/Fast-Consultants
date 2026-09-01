<?php

namespace Tests\Feature;

use App\Enums\DocumentStatus;
use App\Models\StudentDocument;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StudentDocumentTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        Storage::fake('local');
    }

    public function test_a_student_can_upload_list_and_delete_a_document(): void
    {
        $student = User::factory()->student()->create();

        Sanctum::actingAs($student);

        $upload = $this->post('/api/student/documents', [
            'type' => 'passport',
            'title' => 'My Passport',
            'file' => UploadedFile::fake()->create('passport.pdf', 120, 'application/pdf'),
        ], [
            'Accept' => 'application/json',
        ]);

        $upload
            ->assertCreated()
            ->assertJsonPath('data.type', 'passport')
            ->assertJsonPath('data.title', 'My Passport')
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.original_name', 'passport.pdf');

        $documentId = $upload->json('data.id');

        $this->getJson('/api/student/documents')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $documentId);

        $this->deleteJson("/api/student/documents/{$documentId}")
            ->assertOk();

        $this->assertDatabaseMissing('student_documents', [
            'id' => $documentId,
        ]);
    }

    public function test_a_consultant_cannot_upload_student_documents(): void
    {
        $consultant = User::factory()->consultant()->create();

        Sanctum::actingAs($consultant);

        $this->post('/api/student/documents', [
            'type' => 'passport',
            'file' => UploadedFile::fake()->create('passport.pdf', 120, 'application/pdf'),
        ], [
            'Accept' => 'application/json',
        ])->assertForbidden();
    }

    public function test_a_student_cannot_delete_another_students_document(): void
    {
        $owner = User::factory()->student()->create();
        $other = User::factory()->student()->create();

        $document = StudentDocument::query()->create([
            'user_id' => $owner->id,
            'type' => 'passport',
            'title' => 'Passport',
            'original_name' => 'passport.pdf',
            'file_path' => 'student-documents/1/passport.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1000,
            'status' => DocumentStatus::Pending,
        ]);

        Sanctum::actingAs($other);

        $this->deleteJson("/api/student/documents/{$document->id}")
            ->assertForbidden();
    }

    public function test_a_consultant_can_approve_and_reject_student_documents(): void
    {
        $student = User::factory()->student()->create();
        $consultant = User::factory()->consultant()->create();
        $consultant->syncPermissions([
            \App\Enums\Permission::StudentInfoView->value,
            \App\Enums\Permission::StudentInfoManage->value,
        ]);

        Storage::disk('local')->put('student-documents/1/passport.pdf', 'passport');
        Storage::disk('local')->put('student-documents/1/metric.pdf', 'metric');

        $pending = StudentDocument::query()->create([
            'user_id' => $student->id,
            'type' => 'passport',
            'title' => 'Passport',
            'original_name' => 'passport.pdf',
            'file_path' => 'student-documents/1/passport.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1000,
            'status' => DocumentStatus::Pending,
        ]);

        $toReject = StudentDocument::query()->create([
            'user_id' => $student->id,
            'type' => 'metric',
            'title' => 'Metric',
            'original_name' => 'metric.pdf',
            'file_path' => 'student-documents/1/metric.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 900,
            'status' => DocumentStatus::Pending,
        ]);

        Sanctum::actingAs($consultant);

        $this->getJson('/api/consultant/documents')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $this->get("/api/consultant/documents/{$pending->id}/download")
            ->assertOk();

        $this->patchJson("/api/consultant/documents/{$pending->id}/status", [
            'status' => 'approved',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        // Approved files remain listable and viewable.
        $this->getJson('/api/consultant/documents?status=approved')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $pending->id);

        $this->get("/api/consultant/documents/{$pending->id}/download")
            ->assertOk();

        $this->patchJson("/api/consultant/documents/{$toReject->id}/status", [
            'status' => 'rejected',
            'rejection_reason' => 'Image is blurry',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.rejection_reason', 'Image is blurry');

        Sanctum::actingAs($student);

        $this->getJson('/api/student/documents')
            ->assertOk()
            ->assertJsonFragment(['status' => 'approved', 'title' => 'Passport'])
            ->assertJsonFragment(['status' => 'rejected', 'title' => 'Metric']);
    }

    public function test_finance_staff_cannot_access_student_documents(): void
    {
        $student = User::factory()->student()->create();
        $finance = User::factory()->consultant()->create();
        $finance->syncPermissions([
            \App\Enums\Permission::FinanceView->value,
            \App\Enums\Permission::FinanceManage->value,
        ]);

        $document = StudentDocument::query()->create([
            'user_id' => $student->id,
            'type' => 'passport',
            'title' => 'Passport',
            'original_name' => 'passport.pdf',
            'file_path' => 'student-documents/1/passport.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1000,
            'status' => DocumentStatus::Pending,
        ]);

        Sanctum::actingAs($finance);

        $this->getJson('/api/consultant/documents')->assertForbidden();
        $this->get("/api/consultant/documents/{$document->id}/download")->assertForbidden();
    }

    public function test_super_admin_can_download_approved_student_documents(): void
    {
        $student = User::factory()->student()->create();
        $superAdmin = User::factory()->create();
        $superAdmin->assignRole(\App\Enums\Role::SuperAdmin);

        Storage::disk('local')->put('student-documents/1/passport.pdf', 'passport');

        $document = StudentDocument::query()->create([
            'user_id' => $student->id,
            'type' => 'passport',
            'title' => 'Passport',
            'original_name' => 'passport.pdf',
            'file_path' => 'student-documents/1/passport.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1000,
            'status' => DocumentStatus::Approved,
        ]);

        Sanctum::actingAs($superAdmin);

        $this->getJson('/api/consultant/documents?status=approved')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $document->id);

        $this->get("/api/consultant/documents/{$document->id}/download")
            ->assertOk();
    }

    public function test_a_student_can_update_a_pending_document(): void
    {
        $student = User::factory()->student()->create();

        Sanctum::actingAs($student);

        $upload = $this->post('/api/student/documents', [
            'type' => 'passport',
            'title' => 'My Passport',
            'file' => UploadedFile::fake()->create('passport.pdf', 120, 'application/pdf'),
        ], [
            'Accept' => 'application/json',
        ])->assertCreated();

        $documentId = $upload->json('data.id');

        $this->post("/api/student/documents/{$documentId}", [
            'type' => 'intermediate',
            'title' => 'Updated Intermediate',
            'file' => UploadedFile::fake()->create('intermediate.pdf', 140, 'application/pdf'),
        ], [
            'Accept' => 'application/json',
        ])
            ->assertOk()
            ->assertJsonPath('data.type', 'intermediate')
            ->assertJsonPath('data.title', 'Updated Intermediate')
            ->assertJsonPath('data.original_name', 'intermediate.pdf')
            ->assertJsonPath('data.status', 'pending');
    }

    public function test_a_student_can_edit_and_delete_a_rejected_document(): void
    {
        $student = User::factory()->student()->create();

        $document = StudentDocument::query()->create([
            'user_id' => $student->id,
            'type' => 'metric',
            'title' => 'Metric',
            'original_name' => 'metric.pdf',
            'file_path' => 'student-documents/1/metric.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 900,
            'status' => DocumentStatus::Rejected,
            'rejection_reason' => 'Blurry',
        ]);

        Sanctum::actingAs($student);

        $this->post("/api/student/documents/{$document->id}", [
            'type' => 'metric',
            'title' => 'Metric fixed',
        ], [
            'Accept' => 'application/json',
        ])
            ->assertOk()
            ->assertJsonPath('data.title', 'Metric fixed')
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.rejection_reason', null);

        $this->deleteJson("/api/student/documents/{$document->id}")
            ->assertOk();

        $this->assertDatabaseMissing('student_documents', [
            'id' => $document->id,
        ]);
    }

    public function test_a_student_cannot_delete_an_approved_document(): void
    {
        $student = User::factory()->student()->create();

        $document = StudentDocument::query()->create([
            'user_id' => $student->id,
            'type' => 'passport',
            'title' => 'Passport',
            'original_name' => 'passport.pdf',
            'file_path' => 'student-documents/1/passport.pdf',
            'mime_type' => 'application/pdf',
            'file_size' => 1000,
            'status' => DocumentStatus::Approved,
        ]);

        Sanctum::actingAs($student);

        $this->deleteJson("/api/student/documents/{$document->id}")
            ->assertStatus(422);

        $this->post("/api/student/documents/{$document->id}", [
            'type' => 'passport',
            'title' => 'Should not update',
        ], [
            'Accept' => 'application/json',
        ])->assertStatus(422);
    }
}
