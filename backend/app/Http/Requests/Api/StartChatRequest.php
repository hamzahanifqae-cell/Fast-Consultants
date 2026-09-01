<?php

namespace App\Http\Requests\Api;

use App\Enums\StaffDepartment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StartChatRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isStudent() ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'department' => ['required', Rule::enum(StaffDepartment::class)],
            'message' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
