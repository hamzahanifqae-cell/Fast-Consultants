<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'roles' => $this->getRoleNames()->values()->all(),
            'staff_department' => $this->staff_department?->value,
            'staff_department_label' => $this->staff_department?->label(),
            'permissions' => $this->permissionNames(),
            'is_super_admin' => $this->isSuperAdmin(),
            'is_admin' => $this->isAdmin(),
            'is_staff' => $this->isStaff(),
            'is_student' => $this->isStudent(),
            'is_organization' => $this->isConsultant(),
        ];
    }
}
