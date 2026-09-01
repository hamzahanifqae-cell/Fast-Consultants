<?php

namespace App\Http\Controllers\Api;

use App\Enums\Permission as PermissionEnum;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\StoreOrganizationUserRequest;
use App\Http\Requests\Api\UpdateOrganizationUserRequest;
use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class OrganizationUserController extends Controller
{
    public function catalog(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isConsultant(), 403);

        return response()->json([
            'data' => [
                'roles' => [
                    [
                        'value' => Role::Admin->value,
                        'label' => Role::Admin->label(),
                    ],
                    [
                        'value' => Role::Staff->value,
                        'label' => Role::Staff->label(),
                    ],
                ],
                'staff_departments' => collect(StaffDepartment::cases())
                    ->map(fn (StaffDepartment $department) => [
                        'value' => $department->value,
                        'label' => $department->label(),
                    ])
                    ->values(),
                'permissions' => collect(PermissionEnum::assignableBySuperAdmin())
                    ->map(fn (PermissionEnum $permission) => [
                        'value' => $permission->value,
                        'label' => $permission->label(),
                    ])
                    ->values(),
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()?->isSuperAdmin()
                || $request->user()?->canManageOrganizationUsers()
                || $request->user()?->hasAppPermission(PermissionEnum::UsersView),
            403,
        );

        $users = User::query()
            ->role([
                Role::Admin->value,
                Role::Staff->value,
                Role::Consultant->value,
                ...($request->user()->isSuperAdmin() ? [Role::SuperAdmin->value] : []),
            ])
            ->visibleTo($request->user())
            ->with('roles', 'permissions')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => UserResource::collection($users)->resolve(),
        ]);
    }

    public function store(StoreOrganizationUserRequest $request): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin(), 403);

        $role = Role::from($request->string('role')->toString());
        $department = $request->filled('staff_department')
            ? StaffDepartment::from($request->string('staff_department')->toString())
            : null;

        if ($role === Role::Staff && $department === null) {
            throw ValidationException::withMessages([
                'staff_department' => ['A staff department is required.'],
            ]);
        }

        $user = User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => $request->string('email')->toString(),
            'password' => $request->string('password')->toString(),
            'staff_department' => $role === Role::Staff ? $department : null,
        ]);

        $user->assignRole($role);

        $permissions = $request->input('permissions');
        if (! is_array($permissions) || $permissions === []) {
            $permissions = $role === Role::Staff && $department
                ? collect($department->defaultPermissions())->map->value->all()
                : [];
        }

        $user->syncPermissions($permissions);

        return response()->json([
            'data' => UserResource::make($user->load('roles', 'permissions'))->resolve(),
            'message' => 'Organization user created.',
        ], 201);
    }

    public function update(UpdateOrganizationUserRequest $request, User $user): JsonResponse
    {
        abort_unless($request->user()->isSuperAdmin(), 403);
        abort_if($user->isSuperAdmin() && $user->id !== $request->user()->id, 403);
        abort_if($user->isStudent(), 422, 'Students cannot be managed here.');

        if ($request->filled('name')) {
            $user->name = $request->string('name')->toString();
        }

        if ($request->filled('email')) {
            $user->email = $request->string('email')->toString();
        }

        if ($request->filled('password')) {
            $user->password = $request->string('password')->toString();
        }

        if ($request->filled('role')) {
            $role = Role::from($request->string('role')->toString());
            abort_if($role === Role::SuperAdmin, 422, 'Cannot promote users to Super Admin here.');
            $user->syncRoles([$role]);

            if ($role !== Role::Staff) {
                $user->staff_department = null;
            }
        }

        if ($request->exists('staff_department')) {
            $user->staff_department = $request->filled('staff_department')
                ? StaffDepartment::from($request->string('staff_department')->toString())
                : null;
        }

        $user->save();

        if ($request->exists('permissions')) {
            $user->syncPermissions($request->input('permissions', []));
        } elseif ($request->filled('staff_department') && $user->isStaff() && $user->staff_department) {
            $user->syncPermissions(
                collect($user->staff_department->defaultPermissions())->map->value->all(),
            );
        }

        return response()->json([
            'data' => UserResource::make($user->load('roles', 'permissions'))->resolve(),
            'message' => 'Organization user updated.',
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        abort_unless($request->user()?->isSuperAdmin(), 403);
        abort_if($user->isSuperAdmin(), 403, 'Super Admin accounts cannot be deleted.');
        abort_if($user->isStudent(), 422);

        $user->delete();

        return response()->json([
            'message' => 'Organization user removed.',
        ]);
    }
}
