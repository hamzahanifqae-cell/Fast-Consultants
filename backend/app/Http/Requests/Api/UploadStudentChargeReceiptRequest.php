<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;

class UploadStudentChargeReceiptRequest extends FormRequest
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
            'file' => [
                'required',
                'file',
                'max:10240',
                'mimes:pdf,jpg,jpeg,png',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'file.required' => 'Choose a payment screenshot to upload (PDF, JPG, or PNG).',
            'file.file' => 'The upload failed. Large files may be blocked, try a JPG/PNG photo or a smaller PDF.',
            'file.uploaded' => 'The upload failed. Large files may be blocked, try a JPG/PNG photo or a smaller PDF.',
            'file.max' => 'File is too large. Maximum size is 10 MB.',
            'file.mimes' => 'Use a PDF, JPG, or PNG file.',
        ];
    }
}
