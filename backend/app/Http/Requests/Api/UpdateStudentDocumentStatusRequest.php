<?php

namespace App\Http\Requests\Api;

use App\Enums\DocumentStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateStudentDocumentStatusRequest extends FormRequest
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
            'status' => ['required', Rule::in([
                DocumentStatus::Approved->value,
                DocumentStatus::Rejected->value,
            ])],
            'rejection_reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->input('status') === DocumentStatus::Rejected->value
                && blank($this->input('rejection_reason'))) {
                $validator->errors()->add(
                    'rejection_reason',
                    'A rejection reason is required when rejecting a document.',
                );
            }
        });
    }
}
