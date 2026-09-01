<?php

namespace App\Http\Requests\Api;

use App\Enums\ApplicationStage;
use App\Enums\InterviewStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStudentApplicationRequest extends FormRequest
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
            'preparation_title' => ['sometimes', 'nullable', 'string', 'max:150'],
            'preparation_body' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'mark_preparation_complete' => ['sometimes', 'boolean'],
            'unlock_interview' => ['sometimes', 'boolean'],
            'interview_at' => ['sometimes', 'nullable', 'date'],
            'interview_mode' => ['sometimes', 'nullable', 'string', 'max:50'],
            'interview_location' => ['sometimes', 'nullable', 'string', 'max:255'],
            'interview_notes' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'interview_status' => ['sometimes', Rule::enum(InterviewStatus::class)],
            'stage' => ['sometimes', Rule::enum(ApplicationStage::class)],
        ];
    }
}
