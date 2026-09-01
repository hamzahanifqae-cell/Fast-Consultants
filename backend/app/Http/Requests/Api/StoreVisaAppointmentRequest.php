<?php

namespace App\Http\Requests\Api;

use App\Enums\VisaAppointmentStatus;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVisaAppointmentRequest extends FormRequest
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
            'student_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id'),
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $student = User::query()->find($value);
                    if (! $student?->isStudent()) {
                        $fail('The selected student is invalid.');
                    }
                },
            ],
            'scheduled_at' => ['required', 'date'],
            'mode' => ['nullable', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:255'],
            'embassy' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', Rule::enum(VisaAppointmentStatus::class)],
        ];
    }
}
