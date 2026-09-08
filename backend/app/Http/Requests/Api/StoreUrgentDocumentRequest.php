<?php

namespace App\Http\Requests\Api;

use App\Enums\DocumentType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreUrgentDocumentRequest extends FormRequest
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
            'student_id' => ['required', 'integer', 'exists:users,id'],
            'document_types' => ['required', 'array', 'min:1'],
            'document_types.*' => ['required', 'string', Rule::enum(DocumentType::class)],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
