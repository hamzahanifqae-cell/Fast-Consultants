<?php

namespace App\Http\Requests\Api;

use App\Enums\StaffDepartment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StartStudentChatRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->isConsultant() ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'student_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'department' => ['nullable', 'string', Rule::enum(StaffDepartment::class)],
            'message' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
