<?php

namespace App\Http\Controllers\Api;

use App\Enums\StaffDepartment;
use App\Enums\VisaAppointmentStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreVisaAppointmentRequest;
use App\Http\Requests\Api\UpdateVisaAppointmentRequest;
use App\Http\Resources\VisaAppointmentResource;
use App\Models\VisaAppointment;
use App\Services\StudentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class VisaAppointmentController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
    ) {
    }

    public function consultantIndex(Request $request): AnonymousResourceCollection
    {
        $appointments = VisaAppointment::query()
            ->with(['student:id,name,email', 'creator:id,name'])
            ->when(
                $request->filled('student_id'),
                fn ($query) => $query->where('student_id', $request->integer('student_id')),
            )
            ->latest('scheduled_at')
            ->get();

        return VisaAppointmentResource::collection($appointments);
    }

    public function studentIndex(Request $request): AnonymousResourceCollection
    {
        $appointments = VisaAppointment::query()
            ->with(['student:id,name,email', 'creator:id,name'])
            ->where('student_id', $request->user()->id)
            ->latest('scheduled_at')
            ->get();

        return VisaAppointmentResource::collection($appointments);
    }

    public function store(StoreVisaAppointmentRequest $request): JsonResponse
    {
        $appointment = VisaAppointment::query()->create([
            'student_id' => $request->integer('student_id'),
            'created_by' => $request->user()->id,
            'scheduled_at' => $request->date('scheduled_at'),
            'mode' => $request->input('mode'),
            'location' => $request->input('location'),
            'embassy' => $request->input('embassy'),
            'notes' => $request->input('notes'),
            'status' => $request->enum('status', VisaAppointmentStatus::class)
                ?? VisaAppointmentStatus::Scheduled,
        ]);

        $appointment->load(['student:id,name,email', 'creator:id,name']);

        $this->notifications->createForStudent(
            $appointment->student,
            $request->user(),
            'A visa appointment was scheduled'
                .($appointment->scheduled_at ? ' for '.$appointment->scheduled_at->toDayDateTimeString() : '')
                .'.',
            'visa_appointment_scheduled',
            '/student-status',
        );

        $this->notifications->notifyDepartment(
            StaffDepartment::Visa,
            $request->user(),
            'Visa appointment scheduled for '.$appointment->student->name.'.',
            'visa_appointment_scheduled',
            '/departments/visa',
        );

        return VisaAppointmentResource::make($appointment)
            ->response()
            ->setStatusCode(201);
    }

    public function update(
        UpdateVisaAppointmentRequest $request,
        VisaAppointment $visaAppointment,
    ): VisaAppointmentResource {
        $visaAppointment->fill($request->validated());
        $visaAppointment->save();
        $visaAppointment->load(['student:id,name,email', 'creator:id,name']);

        $this->notifications->createForStudent(
            $visaAppointment->student,
            $request->user(),
            'Your visa appointment was updated ('.$visaAppointment->status->label().').',
            'visa_appointment_updated',
            '/student-status',
        );

        return VisaAppointmentResource::make($visaAppointment);
    }

    public function destroy(Request $request, VisaAppointment $visaAppointment): JsonResponse
    {
        abort_unless($request->user()?->isConsultant(), 403);
        $visaAppointment->delete();

        return response()->json([
            'message' => 'Visa appointment removed.',
        ]);
    }
}
