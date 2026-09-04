<?php

namespace App\Http\Controllers\Api;

use App\Enums\ChargeReceiptStatus;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreChargeReceiptRequest;
use App\Http\Requests\Api\UpdateChargeReceiptStatusRequest;
use App\Http\Requests\Api\UploadStudentChargeReceiptRequest;
use App\Http\Resources\ChargeReceiptResource;
use App\Models\ChargeReceipt;
use App\Models\User;
use App\Services\DepartmentHandoffService;
use App\Services\StudentNotificationService;
use App\Services\StudentApplicationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use App\Support\UploadStorage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ChargeReceiptController extends Controller
{
    public function __construct(
        private readonly StudentApplicationService $applications,
        private readonly StudentNotificationService $notifications,
        private readonly DepartmentHandoffService $handoffs,
    )
    {
    }
    public function consultantIndex(Request $request): AnonymousResourceCollection
    {
        $this->assertFinanceStaff($request);

        $receipts = ChargeReceipt::query()
            ->with(['student:id,name,email', 'consultant:id,name,email'])
            ->when(
                $request->filled('student_id'),
                fn ($query) => $query->where('student_id', $request->integer('student_id')),
            )
            ->latest()
            ->get();

        return ChargeReceiptResource::collection($receipts);
    }

    public function studentIndex(Request $request): AnonymousResourceCollection
    {
        $receipts = ChargeReceipt::query()
            ->with(['student:id,name,email', 'consultant:id,name,email'])
            ->where('student_id', $request->user()->id)
            ->latest()
            ->get();

        return ChargeReceiptResource::collection($receipts);
    }

    public function store(StoreChargeReceiptRequest $request): JsonResponse
    {
        $this->assertFinanceStaff($request);

        $student = User::query()->findOrFail($request->integer('student_id'));

        abort_unless(
            $this->handoffs->universitiesShared($student),
            422,
            'Universities has not shared an option with this student yet.',
        );

        $file = $request->file('file');
        $path = $file->store(
            'charge-receipts/consultant/'.$request->user()->id,
            UploadStorage::diskName(),
        );

        $receipt = ChargeReceipt::query()->create([
            'consultant_id' => $request->user()->id,
            'student_id' => $request->integer('student_id'),
            'title' => $request->string('title')->toString(),
            'amount' => $request->input('amount'),
            'currency' => $request->input('currency') ?: 'PKR',
            'notes' => $request->input('notes'),
            'consultant_original_name' => $file->getClientOriginalName(),
            'consultant_file_path' => $path,
            'consultant_mime_type' => $file->getClientMimeType(),
            'consultant_file_size' => $file->getSize() ?: 0,
            'status' => ChargeReceiptStatus::AwaitingStudent,
        ]);

        $receipt->load(['student:id,name,email', 'consultant:id,name,email']);

        $this->handoffs->syncFees($receipt->student, $request->user());

        return ChargeReceiptResource::make($receipt)
            ->response()
            ->setStatusCode(201);
    }

    public function uploadStudentSlip(
        UploadStudentChargeReceiptRequest $request,
        ChargeReceipt $chargeReceipt,
    ): ChargeReceiptResource {
        abort_unless($chargeReceipt->student_id === $request->user()->id, 403);
        abort_unless(in_array($chargeReceipt->status, [
            ChargeReceiptStatus::AwaitingStudent,
            ChargeReceiptStatus::Rejected,
        ], true), 422, 'This slip cannot be uploaded right now.');

        $chargeReceipt->deleteStudentFile();

        $file = $request->file('file');
        $path = $file->store(
            'charge-receipts/student/'.$request->user()->id,
            UploadStorage::diskName(),
        );

        $chargeReceipt->update([
            'student_original_name' => $file->getClientOriginalName(),
            'student_file_path' => $path,
            'student_mime_type' => $file->getClientMimeType(),
            'student_file_size' => $file->getSize() ?: 0,
            'status' => ChargeReceiptStatus::AwaitingReview,
            'rejection_reason' => null,
            'reviewed_at' => null,
        ]);

        $chargeReceipt->load(['student:id,name,email', 'consultant:id,name,email']);

        $this->notifications->notifyDepartment(
            StaffDepartment::Finance,
            $request->user(),
            $request->user()->name.' uploaded a payment slip for "'.$chargeReceipt->title.'".',
            'charge_receipt_uploaded',
            '/departments/finance',
        );

        $this->handoffs->syncFees($request->user(), $request->user());

        return ChargeReceiptResource::make($chargeReceipt);
    }

    public function updateStatus(
        UpdateChargeReceiptStatusRequest $request,
        ChargeReceipt $chargeReceipt,
    ): ChargeReceiptResource {
        $this->assertFinanceStaff($request);
        abort_unless(
            $chargeReceipt->status === ChargeReceiptStatus::AwaitingReview,
            422,
            'Only slips awaiting review can be approved or rejected.',
        );
        abort_unless($chargeReceipt->student_file_path !== null, 422, 'Student has not uploaded a slip yet.');

        $status = ChargeReceiptStatus::from($request->string('status')->toString());

        $student = $chargeReceipt->student;
        $beforeApplication = $this->applications->forStudent($student);
        $beforePreparationUnlockedAt = $beforeApplication->preparation_unlocked_at;

        $chargeReceipt->update([
            'status' => $status,
            'rejection_reason' => $status === ChargeReceiptStatus::Rejected
                ? $request->string('rejection_reason')->toString()
                : null,
            'reviewed_at' => now(),
        ]);

        $chargeReceipt->load(['student:id,name,email', 'consultant:id,name,email']);

        $this->notifications->createForStudent(
            $chargeReceipt->student,
            $request->user(),
            $status === ChargeReceiptStatus::Approved
                ? 'Your charge receipt "' . $chargeReceipt->title . '" was approved.'
                : 'Your charge receipt "' . $chargeReceipt->title . '" was rejected. Reason: ' . ($chargeReceipt->rejection_reason ?? 'Not provided.'),
            $status === ChargeReceiptStatus::Approved ? 'charge_receipt_approved' : 'charge_receipt_rejected',
            '/student-charge-receipts',
        );

        $this->handoffs->syncFees($chargeReceipt->student, $request->user());

        $afterApplication = $this->applications->forStudent($chargeReceipt->student);

        if ($beforePreparationUnlockedAt === null && $afterApplication->preparation_unlocked_at !== null) {
            $this->notifications->createForStudent(
                $chargeReceipt->student,
                $request->user(),
                'Preparation is now unlocked. Check your "Preparation" screen.',
                'preparation_unlocked',
                '/student-preparation',
            );
        }

        return ChargeReceiptResource::make($chargeReceipt);
    }

    public function downloadConsultantFile(Request $request, ChargeReceipt $chargeReceipt): StreamedResponse
    {
        $this->assertCanAccess($request, $chargeReceipt);
        abort_unless(UploadStorage::disk()->exists($chargeReceipt->consultant_file_path), 404);

        return UploadStorage::disk()->download(
            $chargeReceipt->consultant_file_path,
            $chargeReceipt->consultant_original_name,
        );
    }

    public function downloadStudentFile(Request $request, ChargeReceipt $chargeReceipt): StreamedResponse
    {
        $this->assertCanAccess($request, $chargeReceipt);
        abort_unless($chargeReceipt->student_file_path !== null, 404);
        abort_unless(UploadStorage::disk()->exists($chargeReceipt->student_file_path), 404);

        return UploadStorage::disk()->download(
            $chargeReceipt->student_file_path,
            $chargeReceipt->student_original_name ?? 'student-slip.pdf',
        );
    }

    private function assertCanAccess(Request $request, ChargeReceipt $chargeReceipt): void
    {
        $user = $request->user();

        abort_unless(
            $user->canWorkInDepartment(StaffDepartment::Finance)
                || $chargeReceipt->student_id === $user->id,
            403,
        );
    }

    private function assertFinanceStaff(Request $request): void
    {
        abort_unless(
            $request->user()?->canWorkInDepartment(StaffDepartment::Finance),
            403,
            'Only A/C & Finance staff can manage charges.',
        );
    }
}
