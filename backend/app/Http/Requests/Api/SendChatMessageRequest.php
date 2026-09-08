<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SendChatMessageRequest extends FormRequest
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
            'body' => ['nullable', 'string', 'max:5000'],
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
            $body = trim((string) $this->input('body', ''));
            if ($body === '' && ! $this->hasFile('attachment')) {
                $validator->errors()->add('body', 'Enter a message or attach a file.');
            }

            if ($this->filled('scheduled_at') && $this->user()?->isStudent()) {
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
