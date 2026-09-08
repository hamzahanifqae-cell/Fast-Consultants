<?php

namespace App\Http\Requests\Api;

use App\Enums\FormTemplateStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateFormTemplateStatusRequest extends FormRequest
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
                FormTemplateStatus::Approved->value,
                FormTemplateStatus::Rejected->value,
            ])],
            'rejection_reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($this->input('status') === FormTemplateStatus::Rejected->value
                && blank($this->input('rejection_reason'))) {
                $validator->errors()->add(
                    'rejection_reason',
                    'A rejection reason is required when rejecting a filled template.',
                );
            }
        });
    }
}
