<?php

namespace App\Http\Requests\Api;

use App\Enums\DocumentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUniversityRequest extends FormRequest
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
            'name' => ['sometimes', 'required', 'string', 'max:150'],
            'country' => ['sometimes', 'required', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:2000'],
            'is_visible_to_students' => ['sometimes', 'boolean'],
            'required_documents' => ['sometimes', 'required', 'array', 'min:1'],
            'required_documents.*' => ['required', 'string', Rule::enum(DocumentType::class)],
        ];
    }
}
