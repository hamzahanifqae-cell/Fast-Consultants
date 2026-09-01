<?php

namespace App\Http\Requests\Api;

use App\Enums\Permission;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreOrganizationUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isSuperAdmin() ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $assignable = collect(Permission::assignableBySuperAdmin())->map->value->all();

        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'role' => ['required', Rule::in([Role::Admin->value, Role::Staff->value])],
            'staff_department' => [
                'nullable',
                Rule::enum(StaffDepartment::class),
                'required_if:role,'.Role::Staff->value,
            ],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['string', Rule::in($assignable)],
        ];
    }
}
