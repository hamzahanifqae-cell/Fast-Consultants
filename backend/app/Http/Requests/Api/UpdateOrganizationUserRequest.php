<?php

namespace App\Http\Requests\Api;

use App\Enums\Permission;
use App\Enums\Role;
use App\Enums\StaffDepartment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateOrganizationUserRequest extends FormRequest
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
        $userId = $this->route('user')?->id;

        return [
            'name' => ['sometimes', 'required', 'string', 'max:255'],
            'email' => [
                'sometimes',
                'required',
                'string',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($userId),
            ],
            'password' => ['nullable', 'confirmed', Password::min(8)],
            'role' => ['sometimes', 'required', Rule::in([Role::Admin->value, Role::Staff->value])],
            'staff_department' => [
                'nullable',
                Rule::enum(StaffDepartment::class),
            ],
            'permissions' => ['sometimes', 'array'],
            'permissions.*' => ['string', Rule::in($assignable)],
        ];
    }
}
