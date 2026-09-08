<?php

namespace App\Http\Requests\Api;

use App\Enums\StaffDepartment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BroadcastChatMessageRequest extends FormRequest
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
            'student_ids' => ['required', 'array', 'min:1', 'max:100'],
            'student_ids.*' => ['integer', 'distinct', Rule::exists('users', 'id')],
            'message' => ['nullable', 'string', 'max:5000'],
            'department' => ['nullable', 'string', Rule::enum(StaffDepartment::class)],
            'attachment' => [
                'nullable',
                'file',
                'max:51200',
                'mimes:pdf,jpg,jpeg,png,doc,docx,mp4,mov,webm,m4v,avi',
            ],
            'scheduled_at' => ['nullable', 'date', 'after:now'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $message = trim((string) $this->input('message', ''));
            if ($message === '' && ! $this->hasFile('attachment')) {
                $validator->errors()->add('message', 'Enter a message or attach a file.');
            }

            if ($this->filled('scheduled_at') && ! ($this->user()?->isConsultant() ?? false)) {
                $validator->errors()->add('scheduled_at', 'Only staff can schedule messages.');
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'attachment.max' => 'Attachment is too large. Maximum size is 50 MB.',
            'attachment.mimes' => 'Use a PDF, JPG, PNG, DOC, DOCX, or video file (MP4, MOV, WEBM, M4V, AVI).',
        ];
    }
}
