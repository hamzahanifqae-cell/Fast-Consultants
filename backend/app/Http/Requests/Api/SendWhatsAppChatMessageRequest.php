<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SendWhatsAppChatMessageRequest extends FormRequest
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
            'body' => ['nullable', 'string', 'max:4096'],
            'attachment' => [
                'nullable',
                'file',
                'max:16384',
                'mimes:pdf,jpg,jpeg,png,doc,docx,mp4',
            ],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $body = trim((string) $this->input('body', ''));
            if ($body === '' && ! $this->hasFile('attachment')) {
                $validator->errors()->add('body', 'Enter a message or attach a JPG, PNG, PDF, DOC, DOCX, or MP4 file.');
            }
        });
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'attachment.max' => 'WhatsApp attachments must be 16 MB or smaller.',
            'attachment.mimes' => 'WhatsApp supports JPG, PNG, PDF, DOC, DOCX, or MP4.',
        ];
    }
}
