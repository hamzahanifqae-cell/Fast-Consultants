<?php

namespace App\Http\Requests\Api;

use App\Enums\DocumentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStudentDocumentRequest extends FormRequest
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
            'type' => ['required', Rule::enum(DocumentType::class)],
            'title' => ['nullable', 'string', 'max:150'],
            'file' => [
                'required',
                'file',
                'max:10240',
                'mimes:pdf,jpg,jpeg,png,doc,docx',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Choose a file to upload (PDF, JPG, PNG, DOC, or DOCX).',
            'file.file' => 'The upload failed. Large files may be blocked, try a JPG/PNG photo or a smaller PDF.',
            'file.uploaded' => 'The upload failed. Large files may be blocked, try a JPG/PNG photo or a smaller PDF.',
            'file.max' => 'File is too large. Maximum size is 10 MB.',
            'file.mimes' => 'Use a PDF, JPG, PNG, DOC, or DOCX file.',
        ];
    }
}
