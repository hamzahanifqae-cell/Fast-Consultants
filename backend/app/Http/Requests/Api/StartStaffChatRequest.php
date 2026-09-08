<?php

namespace App\Http\Requests\Api;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StartStaffChatRequest extends FormRequest
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
            'peer_user_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id'),
                Rule::notIn([(int) $this->user()?->id]),
            ],
            'message' => ['nullable', 'string', 'max:5000'],
        ];
    }
}
