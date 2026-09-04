<?php

namespace App\Models;

use App\Enums\Permission;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

#[Fillable(['name', 'email', 'password', 'staff_department'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'staff_department' => StaffDepartment::class,
        ];
    }

    /**
     * @return HasMany<Department, $this>
     */
    public function departments(): HasMany
    {
        return $this->hasMany(Department::class, 'consultant_id');
    }

    /**
     * @return HasOne<StudentProfile, $this>
     */
    public function studentProfile(): HasOne
    {
        return $this->hasOne(StudentProfile::class);
    }

    /**
     * @return HasMany<StudentDocument, $this>
     */
    public function studentDocuments(): HasMany
    {
        return $this->hasMany(StudentDocument::class);
    }

    /**
     * @return HasMany<Question, $this>
     */
    public function askedQuestions(): HasMany
    {
        return $this->hasMany(Question::class, 'student_id');
    }

    /**
     * @return HasMany<Question, $this>
     */
    public function receivedQuestions(): HasMany
    {
        return $this->hasMany(Question::class, 'consultant_id');
    }

    /**
     * @return HasMany<University, $this>
     */
    public function universities(): HasMany
    {
        return $this->hasMany(University::class, 'consultant_id');
    }

    /**
     * Universities staff have shared with this student.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany<University, $this>
     */
    public function assignedUniversities(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(University::class, 'student_university', 'student_id', 'university_id')
            ->withPivot(['assigned_by', 'notes'])
            ->withTimestamps();
    }

    public function isStudent(): bool
    {
        return $this->hasRole(Role::Student);
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole(Role::SuperAdmin);
    }

    public function isAdmin(): bool
    {
        return $this->hasRole(Role::Admin);
    }

    public function isStaff(): bool
    {
        return $this->hasRole(Role::Staff);
    }

    /**
     * Organization side (legacy consultant + new RBAC roles).
     */
    public function isConsultant(): bool
    {
        return $this->hasAnyRole([
            Role::SuperAdmin->value,
            Role::Admin->value,
            Role::Staff->value,
            Role::Consultant->value,
        ]);
    }

    public function canAssignPermissions(): bool
    {
        return $this->isSuperAdmin() || $this->can(Permission::PermissionsAssign->value);
    }

    public function canManageOrganizationUsers(): bool
    {
        return $this->isSuperAdmin() || $this->can(Permission::UsersManage->value);
    }

    public function hasAppPermission(Permission|string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        $name = $permission instanceof Permission ? $permission->value : $permission;

        return $this->can($name);
    }

    public function canAccessDepartment(StaffDepartment $department): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        return $this->hasAppPermission($department->viewPermission())
            || $this->hasAppPermission($department->managePermission());
    }

    /**
     * Whether the user may act on a department's own work. Super Admin and Admin
     * span the whole organization; staff are limited to the departments they hold
     * permissions for.
     */
    public function canWorkInDepartment(StaffDepartment $department): bool
    {
        if ($this->isSuperAdmin() || $this->isAdmin()) {
            return true;
        }

        return $this->canAccessDepartment($department);
    }

    /**
     * @return list<StaffDepartment>
     */
    public function accessibleDepartments(): array
    {
        if (! $this->isConsultant()) {
            return [];
        }

        if ($this->isSuperAdmin()) {
            return StaffDepartment::cases();
        }

        return array_values(array_filter(
            StaffDepartment::cases(),
            fn (StaffDepartment $department) => $this->canAccessDepartment($department),
        ));
    }

    public function canViewUser(User $other): bool
    {
        if ($other->isSuperAdmin() && ! $this->isSuperAdmin()) {
            return false;
        }

        if ($this->isStudent() || $other->isStudent()) {
            return $this->id === $other->id || $this->isConsultant();
        }

        return $this->isConsultant();
    }

    /**
     * @param  Builder<User>  $query
     * @return Builder<User>
     */
    public function scopeVisibleTo(Builder $query, User $viewer): Builder
    {
        if ($viewer->isSuperAdmin()) {
            return $query;
        }

        return $query->whereDoesntHave('roles', function (Builder $roles) {
            $roles->where('name', Role::SuperAdmin->value);
        });
    }

    /**
     * @return list<string>
     */
    public function permissionNames(): array
    {
        if ($this->isSuperAdmin()) {
            return collect(Permission::cases())->map->value->values()->all();
        }

        return $this->getAllPermissions()->pluck('name')->values()->all();
    }
}
