<?php

namespace App\Http\Controllers\Api;

use App\Enums\AccountApprovalStatus;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\StudentNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class StudentAccountApprovalController extends Controller
{
    public function __construct(
        private readonly StudentNotificationService $notifications,
    ) {
    }

    public function index(Request $request): JsonResponse
    {
        $this->ensureCanManage($request);

        $status = $request->string('status')->toString();
        $query = User::query()
            ->role(Role::Student->value)
            ->whereNotNull('account_approval_status')
            ->with('accountReviewer:id,name,email')
            ->latest('id');

        if (in_array($status, ['pending', 'approved', 'rejected'], true)) {
            $query->where('account_approval_status', $status);
        } else {
            $query->where('account_approval_status', AccountApprovalStatus::Pending->value);
        }

        $users = $query->limit(100)->get();

        return response()->json([
            'data' => $users->map(fn (User $user) => $this->payload($user))->values(),
        ]);
    }

    public function approve(Request $request, User $user): JsonResponse
    {
        $this->ensureCanManage($request);
        $this->ensurePendingStudent($user);

        $user->forceFill([
            'account_approval_status' => AccountApprovalStatus::Approved,
            'account_approved_at' => now(),
            'account_reviewed_by' => $request->user()->id,
            'account_rejection_reason' => null,
        ])->save();

        $this->notifications->createForUser(
            $user,
            $request->user(),
            'Your student account was approved. You can sign in now.',
            'account_registration_approved',
            '/student/login',
            null,
            'account_request:'.$user->id,
            true,
        );

        return response()->json([
            'data' => $this->payload($user->fresh()->load('accountReviewer:id,name,email')),
            'message' => 'Account approved. The student can sign in now.',
        ]);
    }

    public function reject(Request $request, User $user): JsonResponse
    {
        $this->ensureCanManage($request);
        $this->ensurePendingStudent($user);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $user->forceFill([
            'account_approval_status' => AccountApprovalStatus::Rejected,
            'account_approved_at' => null,
            'account_reviewed_by' => $request->user()->id,
            'account_rejection_reason' => $validated['reason'] ?? null,
        ])->save();

        $this->notifications->createForUser(
            $user,
            $request->user(),
            'Your student account request was rejected'
                .(filled($validated['reason'] ?? null) ? ': '.$validated['reason'] : '.')
                .' Contact Fast Consultants if you need help.',
            'account_registration_rejected',
            '/student/login',
            null,
            'account_request:'.$user->id,
            true,
        );

        return response()->json([
            'data' => $this->payload($user->fresh()->load('accountReviewer:id,name,email')),
            'message' => 'Account request rejected.',
        ]);
    }

    private function ensurePendingStudent(User $user): void
    {
        abort_unless($user->isStudent(), 404);

        if ($user->accountApprovalStatus() !== AccountApprovalStatus::Pending) {
            throw ValidationException::withMessages([
                'user' => ['Only pending account requests can be reviewed.'],
            ]);
        }
    }

    private function ensureCanManage(Request $request): void
    {
        $user = $request->user();
        abort_unless(
            $user?->canWorkInDepartment(StaffDepartment::Leads)
                || $user?->hasAppPermission('leads.manage')
                || $user?->hasAppPermission('leads.view'),
            403,
            'Only Leads staff can review student account requests.',
        );
    }

    /**
     * @return array<string, mixed>
     */
    private function payload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'account_approval_status' => $user->accountApprovalStatus()->value,
            'account_approval_status_label' => $user->accountApprovalStatus()->label(),
            'account_approved_at' => $user->account_approved_at?->toIso8601String(),
            'account_rejection_reason' => $user->account_rejection_reason,
            'reviewed_by' => $user->accountReviewer
                ? [
                    'id' => $user->accountReviewer->id,
                    'name' => $user->accountReviewer->name,
                    'email' => $user->accountReviewer->email,
                ]
                : null,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }
}
