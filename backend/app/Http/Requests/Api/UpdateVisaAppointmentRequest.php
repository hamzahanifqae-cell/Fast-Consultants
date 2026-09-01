<?php

namespace App\Http\Requests\Api;

use App\Enums\VisaAppointmentStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateVisaAppointmentRequest extends FormRequest
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
            'scheduled_at' => ['sometimes', 'required', 'date'],
            'mode' => ['nullable', 'string', 'max:100'],
            'location' => ['nullable', 'string', 'max:255'],
            'embassy' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'status' => ['sometimes', 'required', Rule::enum(VisaAppointmentStatus::class)],
        ];
    }
}
