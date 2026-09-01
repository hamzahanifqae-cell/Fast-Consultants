<?php

namespace App\Services;

use App\Enums\Role;
use App\Enums\StaffDepartment;
use App\Models\User;
use App\Models\UserNotification;
use Illuminate\Database\Eloquent\Builder;

class StudentNotificationService
{
    public function createForUser(
        User $user,
        ?User $actor,
        string $message,
        ?string $type = null,
        ?string $action = null,
        ?int $conversationId = null,
    ): UserNotification {
        return UserNotification::query()->create([
            'user_id' => $user->id,
            'actor_id' => $actor?->id,
            'conversation_id' => $conversationId,
            'type' => $type,
            'action' => $action,
            'message' => $message,
        ]);
    }

    public function createForStudent(
        User $student,
        ?User $consultant,
        string $message,
        ?string $type = null,
        ?string $action = null,
        ?int $conversationId = null,
    ): UserNotification {
        return $this->createForUser(
            $student,
            $consultant,
            $message,
            $type,
            $action,
            $conversationId,
        );
    }

    /**
     * Notify organization users who can access this department (Super Admin, Admin, Staff).
     */
    public function notifyDepartment(
        StaffDepartment $department,
        ?User $actor,
        string $message,
        ?string $type = null,
        ?string $action = null,
        ?int $conversationId = null,
    ): void {
        $this->notifyDepartments(
            [$department],
            $actor,
            $message,
            $type,
            $action,
            $conversationId,
        );
    }

    /**
     * @param  list<StaffDepartment>  $departments
     */
    public function notifyDepartments(
        array $departments,
        ?User $actor,
        string $message,
        ?string $type = null,
        ?string $action = null,
        ?int $conversationId = null,
    ): void {
        $seen = [];

        foreach ($departments as $department) {
            foreach ($this->usersForDepartment($department, $actor?->id) as $user) {
                if (isset($seen[$user->id])) {
                    continue;
                }

                $seen[$user->id] = true;
                $this->createForUser(
                    $user,
                    $actor,
                    $message,
                    $type,
                    $action,
                    $conversationId,
                );
            }
        }
    }

    /**
     * @return list<User>
     */
    public function usersForDepartment(StaffDepartment $department, ?int $exceptUserId = null): array
    {
        return User::query()
            ->when($exceptUserId, fn (Builder $query) => $query->where('id', '!=', $exceptUserId))
            ->whereHas('roles', function (Builder $roles) {
                $roles->whereIn('name', [
                    Role::SuperAdmin->value,
                    Role::Admin->value,
                    Role::Staff->value,
                    Role::Consultant->value,
                ]);
            })
            ->get()
            ->filter(fn (User $user) => $user->canAccessDepartment($department))
            ->values()
            ->all();
    }
}
