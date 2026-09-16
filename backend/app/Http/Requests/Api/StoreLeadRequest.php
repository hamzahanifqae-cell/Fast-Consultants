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
            'whatsapp' => ['nullable', 'string', 'max:40'],
            'city' => ['required', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'visa_refusal' => ['nullable', 'string', 'in:Yes,No'],
            'marital_status' => ['nullable', 'string', 'in:Single,Married'],
            'date_of_birth' => ['nullable', 'date', 'before:today'],
            'preferred_country' => ['required', 'string', 'max:120'],
            'study_level' => ['required', 'string', 'max:120'],
            'intended_program' => ['required', 'string', 'max:190'],
            'preferred_intake' => ['required', 'string', 'max:120'],
            'intake_year' => ['required', 'integer', 'min:2026', 'max:2100'],
            'qualification' => ['required', 'string', 'max:190'],
            'grade' => ['required', 'string', 'max:120'],
            'passing_year' => ['nullable', 'string', 'max:20'],
            'english_status' => ['nullable', 'string', 'max:190'],
            'english_score' => ['nullable', 'string', 'max:190'],
            'english_tests' => ['nullable', 'array', 'max:8'],
            'english_tests.*.test' => ['required', 'string', 'max:40'],
            'english_tests.*.score' => ['nullable', 'string', 'max:120'],
            'travel_history' => ['nullable', 'string', 'max:2000'],
            'budget_range' => ['required', 'string', 'max:120'],
            'services' => ['nullable', 'array'],
            'services.*' => ['string', 'max:120'],
            'contact_method' => ['nullable', 'string', 'max:120'],
            'contact_time' => ['nullable', 'string', 'max:190'],
            'source' => ['nullable', 'string', 'max:120'],
        ];
    }
}
