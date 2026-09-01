<?php

namespace App\Http\Requests\Api;

use App\Enums\Role;
use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreChargeReceiptRequest extends FormRequest
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
            'student_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id'),
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $student = User::query()->find($value);

                    if (! $student || ! $student->hasRole(Role::Student)) {
                        $fail('The selected student is invalid.');
                    }
                },
            ],
            'title' => ['required', 'string', 'max:150'],
            'amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'notes' => ['nullable', 'string', 'max:2000'],
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
            'file.required' => 'Choose a slip file to send (PDF, JPG, or PNG).',
            'file.file' => 'The upload failed. Large files may be blocked, try a JPG/PNG photo or a smaller PDF.',
            'file.uploaded' => 'The upload failed. Large files may be blocked, try a JPG/PNG photo or a smaller PDF.',
            'file.max' => 'File is too large. Maximum size is 10 MB.',
            'file.mimes' => 'Use a PDF, JPG, or PNG file.',
        ];
    }
}
