<?php

namespace Tests\Feature;

use App\Enums\ChargeReceiptStatus;
use App\Models\ChargeReceipt;
use App\Models\University;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ChargeReceiptTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RoleSeeder::class);
        Storage::fake('local');
    }

    public function test_consultant_uploads_slip_student_reuploads_and_consultant_rechecks(): void
    {
        $consultant = $this->makeFinanceStaff();
        $student = User::factory()->student()->create();
        $this->letFinanceRaiseCharges($student);

        Sanctum::actingAs($consultant);

        $create = $this->post('/api/consultant/charge-receipts', [
            'student_id' => $student->id,
            'title' => 'Application fee slip',
            'amount' => 25000,
            'currency' => 'PKR',
            'notes' => 'Pay and upload the stamped slip',
            'file' => UploadedFile::fake()->create('charges.pdf', 100, 'application/pdf'),
        ], [
            'Accept' => 'application/json',
        ]);

        $create
            ->assertCreated()
            ->assertJsonPath('data.title', 'Application fee slip')
            ->assertJsonPath('data.status', 'awaiting_student')
            ->assertJsonPath('data.consultant_file.original_name', 'charges.pdf');

        $receiptId = $create->json('data.id');

        Sanctum::actingAs($student);

        $this->getJson('/api/student/charge-receipts')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $receiptId);

        $this->post("/api/student/charge-receipts/{$receiptId}/upload", [
            'file' => UploadedFile::fake()->create('paid-slip.pdf', 120, 'application/pdf'),
        ], [
            'Accept' => 'application/json',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'awaiting_review')
            ->assertJsonPath('data.student_file.original_name', 'paid-slip.pdf');

        Sanctum::actingAs($consultant);

        $this->patchJson("/api/consultant/charge-receipts/{$receiptId}/status", [
            'status' => 'approved',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_consultant_can_reject_student_slip_with_reason(): void
    {
        $consultant = $this->makeFinanceStaff();
        $student = User::factory()->student()->create();

        $receipt = ChargeReceipt::query()->create([
            'consultant_id' => $consultant->id,
            'student_id' => $student->id,
            'title' => 'Fee slip',
            'amount' => 1000,
            'currency' => 'PKR',
            'notes' => null,
            'consultant_original_name' => 'charges.pdf',
            'consultant_file_path' => 'charge-receipts/consultant/1/charges.pdf',
            'consultant_mime_type' => 'application/pdf',
            'consultant_file_size' => 100,
            'student_original_name' => 'paid.pdf',
            'student_file_path' => 'charge-receipts/student/1/paid.pdf',
            'student_mime_type' => 'application/pdf',
            'student_file_size' => 110,
            'status' => ChargeReceiptStatus::AwaitingReview,
        ]);

        Sanctum::actingAs($consultant);

        $this->patchJson("/api/consultant/charge-receipts/{$receipt->id}/status", [
            'status' => 'rejected',
            'rejection_reason' => 'Stamp is missing',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected')
            ->assertJsonPath('data.rejection_reason', 'Stamp is missing');

        Sanctum::actingAs($student);

        $this->post("/api/student/charge-receipts/{$receipt->id}/upload", [
            'file' => UploadedFile::fake()->create('paid-again.pdf', 120, 'application/pdf'),
        ], [
            'Accept' => 'application/json',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'awaiting_review');
    }

    public function test_consultant_can_list_students(): void
    {
        $consultant = User::factory()->consultant()->create();
        User::factory()->student()->create(['name' => 'Ali Student']);

        Sanctum::actingAs($consultant);

        $this->getJson('/api/consultant/students')
            ->assertOk()
            ->assertJsonFragment(['name' => 'Ali Student']);
    }

    public function test_student_finance_and_super_admin_can_view_slips_anytime(): void
    {
        $superAdmin = User::factory()->create();
        $superAdmin->assignRole(\App\Enums\Role::SuperAdmin);
        $finance = User::factory()->consultant()->create();
        $finance->syncPermissions([
            \App\Enums\Permission::FinanceView->value,
            \App\Enums\Permission::FinanceManage->value,
        ]);
        $student = User::factory()->student()->create();
        $otherStudent = User::factory()->student()->create();

        $consultantFile = UploadedFile::fake()->create('charges.pdf', 100, 'application/pdf');
        $consultantPath = $consultantFile->store('charge-receipts/consultant/1', 'local');
        $studentFile = UploadedFile::fake()->create('paid.pdf', 120, 'application/pdf');
        $studentPath = $studentFile->store('charge-receipts/student/1', 'local');

        $receipt = ChargeReceipt::query()->create([
            'consultant_id' => $finance->id,
            'student_id' => $student->id,
            'title' => 'Consultancy fee',
            'amount' => 10000,
            'currency' => 'PKR',
            'notes' => null,
            'consultant_original_name' => 'charges.pdf',
            'consultant_file_path' => $consultantPath,
            'consultant_mime_type' => 'application/pdf',
            'consultant_file_size' => 100,
            'student_original_name' => 'paid.pdf',
            'student_file_path' => $studentPath,
            'student_mime_type' => 'application/pdf',
            'student_file_size' => 120,
            'status' => ChargeReceiptStatus::Approved,
        ]);

        Sanctum::actingAs($student);
        $this->get("/api/student/charge-receipts/{$receipt->id}/consultant-file")->assertOk();
        $this->get("/api/student/charge-receipts/{$receipt->id}/student-file")->assertOk();

        Sanctum::actingAs($otherStudent);
        $this->get("/api/student/charge-receipts/{$receipt->id}/consultant-file")->assertForbidden();

        Sanctum::actingAs($finance);
        $this->get("/api/consultant/charge-receipts/{$receipt->id}/consultant-file")->assertOk();
        $this->get("/api/consultant/charge-receipts/{$receipt->id}/student-file")->assertOk();

        Sanctum::actingAs($superAdmin);
        $this->get("/api/consultant/charge-receipts/{$receipt->id}/consultant-file")->assertOk();
        $this->get("/api/consultant/charge-receipts/{$receipt->id}/student-file")->assertOk();
    }

    private function makeFinanceStaff(): User
    {
        $finance = User::factory()->consultant()->create();
        $finance->syncPermissions([
            \App\Enums\Permission::FinanceView->value,
            \App\Enums\Permission::FinanceManage->value,
        ]);

        return $finance->fresh();
    }

    /** Charges can only be raised once Universities has shared an option. */
    private function letFinanceRaiseCharges(User $student): void
    {
        $university = University::query()->create([
            'consultant_id' => User::factory()->consultant()->create()->id,
            'name' => 'Shared University',
            'country' => 'Canada',
            'city' => 'Toronto',
            'is_visible_to_students' => true,
        ]);

        $student->assignedUniversities()->syncWithoutDetaching([$university->id]);
    }
}
