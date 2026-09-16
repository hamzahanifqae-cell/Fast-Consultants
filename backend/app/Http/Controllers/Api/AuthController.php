<?php

namespace App\Http\Controllers\Api;

use App\Enums\AccountApprovalStatus;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\LoginRequest;
use App\Http\Requests\Api\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\StudentProfile;
use App\Models\User;
use App\Services\StudentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
    ) {
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => $request->string('email')->toString(),
            'password' => $request->string('password')->toString(),
            'account_approval_status' => AccountApprovalStatus::Pending,
        ]);

        $user->assignRole(Role::Student);

        StudentProfile::query()->create([
            'user_id' => $user->id,
        ]);

        $this->notifications->notifyDepartment(
            StaffDepartment::Leads,
            $user,
            "{$user->name} ({$user->email}) requested a student account. Review and approve or reject.",
            'account_registration_pending',
            '/departments/leads',
            null,
            'account_request:'.$user->id,
            true,
        );

        return response()->json([
            'message' => 'Account created. Leads staff will review your request. You can sign in after it is approved.',
            'approval_status' => AccountApprovalStatus::Pending->value,
            'approval_status_label' => AccountApprovalStatus::Pending->label(),
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'roles' => [Role::Student->value],
                'account_approval_status' => AccountApprovalStatus::Pending->value,
            ],
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::query()->where('email', $request->string('email')->toString())->first();

        if (! $user || ! Hash::check($request->string('password')->toString(), $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->isStudent() && ! $user->canSignIn()) {
            $status = $user->accountApprovalStatus();

            if ($status === AccountApprovalStatus::Pending) {
                return response()->json([
                    'message' => 'Your account is pending approval from Leads staff. Please wait until it is approved.',
                    'approval_status' => AccountApprovalStatus::Pending->value,
                    'approval_status_label' => AccountApprovalStatus::Pending->label(),
                ], 403);
            }

            return response()->json([
                'message' => 'Your account request was rejected'
                    .($user->account_rejection_reason
                        ? ': '.$user->account_rejection_reason
                        : ' by Leads staff.')
                    .' Contact Fast Consultants if you need help.',
                'approval_status' => AccountApprovalStatus::Rejected->value,
                'approval_status_label' => AccountApprovalStatus::Rejected->label(),
                'rejection_reason' => $user->account_rejection_reason,
            ], 403);
        }

        return $this->tokenResponse($user, $user->createToken('mobile')->plainTextToken);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => UserResource::make($request->user())->resolve(),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out.',
        ]);
    }

    private function tokenResponse(User $user, string $token, int $status = 200): JsonResponse
    {
        $user->load('roles');

        return response()->json([
            'token' => $token,
            'user' => UserResource::make($user)->resolve(),
        ], $status);
    }
}
