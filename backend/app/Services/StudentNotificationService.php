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
        ?string $subjectKey = null,
        bool $replaceSubject = false,
    ): UserNotification {
        if ($replaceSubject && filled($subjectKey)) {
            $existing = UserNotification::query()
                ->where('user_id', $user->id)
                ->where('subject_key', $subjectKey)
                ->whereNull('read_at')
                ->latest('id')
                ->first();

            if ($existing) {
                $existing->forceFill([
                    'actor_id' => $actor?->id,
                    'conversation_id' => $conversationId,
                    'type' => $type,
                    'action' => $action,
                    'message' => $message,
                    'created_at' => now(),
                ])->save();

                return $existing->refresh();
            }
        }

        return UserNotification::query()->create([
            'user_id' => $user->id,
            'actor_id' => $actor?->id,
            'conversation_id' => $conversationId,
            'type' => $type,
            'action' => $action,
            'subject_key' => $subjectKey,
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
        ?string $subjectKey = null,
        bool $replaceSubject = false,
    ): UserNotification {
        return $this->createForUser(
            $student,
            $consultant,
            $message,
            $type,
            $action,
            $conversationId,
            $subjectKey,
            $replaceSubject,
        );
    }

    /**
     * Notify staff assigned to this department only (matched by staff_department).
     * Super Admin / Admin are not included in department fan-out.
     */
    public function notifyDepartment(
        StaffDepartment $department,
        ?User $actor,
        string $message,
        ?string $type = null,
        ?string $action = null,
        ?int $conversationId = null,
        ?string $subjectKey = null,
        bool $replaceSubject = false,
    ): void {
        $this->notifyDepartments(
            [$department],
            $actor,
            $message,
            $type,
            $action,
            $conversationId,
            $subjectKey,
            $replaceSubject,
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
        ?string $subjectKey = null,
        bool $replaceSubject = false,
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
                    $subjectKey,
                    $replaceSubject,
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
                    Role::Staff->value,
                    Role::Consultant->value,
                ]);
            })
            ->where('staff_department', $department->value)
            ->get()
            ->filter(fn (User $user) => $user->canAccessDepartment($department))
            ->values()
            ->all();
    }
}
