<?php

namespace App\Http\Controllers\Api;

use App\Enums\LeadStatus;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\ConvertLeadRequest;
use App\Http\Requests\Api\StoreLeadRequest;
use App\Jobs\ClassifyLeadJob;
use App\Models\Lead;
use App\Models\StudentProfile;
use App\Models\User;
use App\Services\StudentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class LeadController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
    ) {
    }

    public function store(StoreLeadRequest $request): JsonResponse
    {
        $data = $request->validated();
        $lead = Lead::query()->create([
            ...$data,
            'education_level' => $data['study_level'] ?? null,
            'intake_year' => isset($data['intake_year']) ? (string) $data['intake_year'] : null,
            'source' => $request->input('source') ?: 'leading_page',
            'status' => LeadStatus::New,
        ]);

        $this->notifications->notifyDepartment(
            StaffDepartment::Leads,
            null,
            "New lead form from {$lead->name} ({$lead->email}). Classification is running.",
            'lead_submitted',
            '/departments/leads',
        );

        ClassifyLeadJob::dispatch($lead->id);

        return response()->json([
            'data' => [
                'id' => $lead->id,
                'message' => 'Thanks — your form was submitted. Our admissions team will review it shortly.',
            ],
        ], 201);
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureCanView($request);

        $status = $request->string('status')->toString();
        $classification = $request->string('classification')->toString();

        $leads = Lead::query()
            ->with(['convertedUser:id,name,email'])
            ->when($status !== '', fn ($query) => $query->where('status', $status))
            ->when($classification !== '', fn ($query) => $query->where('classification', $classification))
            ->latest('id')
            ->limit(200)
            ->get()
            ->map(fn (Lead $lead) => $this->payload($lead));

        return response()->json(['data' => $leads]);
    }

    public function show(Request $request, Lead $lead): JsonResponse
    {
        $this->ensureCanView($request);
        $lead->loadMissing(['convertedUser:id,name,email']);

        return response()->json(['data' => $this->payload($lead)]);
    }

    public function convert(ConvertLeadRequest $request, Lead $lead): JsonResponse
    {
        $this->ensureCanManage($request);

        if ($lead->status === LeadStatus::Converted && $lead->converted_user_id) {
            throw ValidationException::withMessages([
                'lead' => ['This lead already has student credentials.'],
            ]);
        }

        $name = trim((string) ($request->input('name') ?: $lead->name));
        $email = strtolower(trim((string) ($request->input('email') ?: $lead->email)));

        if (User::query()->where('email', $email)->exists()) {
            throw ValidationException::withMessages([
                'email' => ['A user with this email already exists.'],
            ]);
        }

        $password = $request->string('password')->toString();

        $user = DB::transaction(function () use ($request, $lead, $name, $email, $password) {
            $user = User::query()->create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'email_verified_at' => now(),
            ]);
            $user->assignRole(Role::Student);
            StudentProfile::query()->create([
                'user_id' => $user->id,
                'phone' => $lead->phone,
            ]);

            $lead->forceFill([
                'status' => LeadStatus::Converted,
                'converted_user_id' => $user->id,
                'converted_by' => $request->user()->id,
                'converted_at' => now(),
                'staff_notes' => $request->input('staff_notes', $lead->staff_notes),
                'dismissed_at' => null,
                'dismissed_by' => null,
            ])->save();

            return $user;
        });

        $this->notifications->createForUser(
            $user,
            $request->user(),
            'Your student account is ready. Sign in with the email and password provided by Fast Consultants.',
            'lead_converted',
            '/student/login',
        );

        return response()->json([
            'data' => [
                'lead' => $this->payload($lead->fresh()->load('convertedUser:id,name,email')),
                'credentials' => [
                    'email' => $user->email,
                    'password' => $password,
                    'login_url' => '/student/login',
                ],
            ],
        ]);
    }

    public function dismiss(Request $request, Lead $lead): JsonResponse
    {
        $this->ensureCanManage($request);

        if ($lead->status === LeadStatus::Converted) {
            throw ValidationException::withMessages([
                'lead' => ['Converted leads cannot be dismissed.'],
            ]);
        }

        $lead->forceFill([
            'status' => LeadStatus::Dismissed,
            'dismissed_by' => $request->user()->id,
            'dismissed_at' => now(),
            'staff_notes' => $request->input('staff_notes', $lead->staff_notes),
        ])->save();

        return response()->json(['data' => $this->payload($lead)]);
    }

    private function ensureCanView(Request $request): void
    {
        $user = $request->user();
        abort_unless($user?->isConsultant(), 403);
        abort_unless(
            $user->canWorkInDepartment(StaffDepartment::Leads)
                || $user->can('leads.view')
                || $user->can('leads.manage'),
            403,
            'Leads access required.',
        );
    }

    private function ensureCanManage(Request $request): void
    {
        $user = $request->user();
        abort_unless($user?->isConsultant(), 403);
        abort_unless(
            $user->canWorkInDepartment(StaffDepartment::Leads)
                || $user->can('leads.manage'),
            403,
            'Leads manage access required.',
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(Lead $lead): array
    {
        return [
            'id' => $lead->id,
            'name' => $lead->name,
            'email' => $lead->email,
            'phone' => $lead->phone,
            'city' => $lead->city,
            'preferred_country' => $lead->preferred_country,
            'study_level' => $lead->study_level,
            'education_level' => $lead->education_level,
            'intended_program' => $lead->intended_program,
            'budget_range' => $lead->budget_range,
            'preferred_intake' => $lead->preferred_intake,
            'intake_year' => $lead->intake_year,
            'qualification' => $lead->qualification,
            'grade' => $lead->grade,
            'english_status' => $lead->english_status,
            'english_score' => $lead->english_score,
            'services' => $lead->services ?? [],
            'contact_method' => $lead->contact_method,
            'contact_time' => $lead->contact_time,
            'timeline' => $lead->timeline,
            'message' => $lead->message,
            'source' => $lead->source,
            'status' => $lead->status?->value,
            'status_label' => $lead->status?->label(),
            'classification' => $lead->classification?->value,
            'classification_label' => $lead->classification?->label(),
            'classification_score' => $lead->classification_score,
            'classification_reason' => $lead->classification_reason,
            'classification_model' => $lead->classification_model,
            'classified_at' => $lead->classified_at?->toIso8601String(),
            'converted_user' => $lead->convertedUser
                ? [
                    'id' => $lead->convertedUser->id,
                    'name' => $lead->convertedUser->name,
                    'email' => $lead->convertedUser->email,
                ]
                : null,
            'converted_at' => $lead->converted_at?->toIso8601String(),
            'dismissed_at' => $lead->dismissed_at?->toIso8601String(),
            'staff_notes' => $lead->staff_notes,
            'created_at' => $lead->created_at?->toIso8601String(),
        ];
    }
}
