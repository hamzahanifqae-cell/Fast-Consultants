<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class StoreLeadRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['required', 'string', 'max:40'],
            'city' => ['required', 'string', 'max:120'],
            'preferred_country' => ['required', 'string', 'max:120'],
            'study_level' => ['required', 'string', 'max:120'],
            'intended_program' => ['required', 'string', 'max:190'],
            'preferred_intake' => ['required', 'string', 'max:120'],
            'intake_year' => ['required', 'integer', 'min:2026', 'max:2100'],
            'qualification' => ['required', 'string', 'max:190'],
            'grade' => ['required', 'string', 'max:120'],
            'english_status' => ['nullable', 'string', 'max:120'],
            'english_score' => ['nullable', 'string', 'max:120'],
            'budget_range' => ['required', 'string', 'max:120'],
            'services' => ['required', 'array', 'min:1'],
            'services.*' => ['string', 'max:120'],
            'contact_method' => ['nullable', 'string', 'max:120'],
            'contact_time' => ['nullable', 'string', 'max:190'],
            'source' => ['nullable', 'string', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'services.required' => 'Select at least one counselling service.',
            'services.min' => 'Select at least one counselling service.',
        ];
    }
}
