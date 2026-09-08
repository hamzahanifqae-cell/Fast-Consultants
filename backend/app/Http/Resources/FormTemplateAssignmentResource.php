<?php

namespace App\Http\Resources;

use App\Models\FormTemplateAssignment;
use App\Support\FormTemplates\FormTemplateCatalog;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin FormTemplateAssignment
 */
class FormTemplateAssignmentResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        $definition = $this->templateDefinition()
            ?? FormTemplateCatalog::find(FormTemplateCatalog::defaultKey());

        return [
            'id' => $this->id,
            'template_key' => $this->template_key,
            'title' => $this->title,
            'instructions' => $this->instructions,
            'letter_body' => $definition['letter_body'] ?? '',
            'fields' => $definition['fields'] ?? [],
            'answers' => $this->answers,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'rejection_reason' => $this->rejection_reason,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'sender' => $this->whenLoaded('sender', fn () => $this->sender ? [
                'id' => $this->sender->id,
                'name' => $this->sender->name,
                'email' => $this->sender->email,
            ] : null),
            'student' => $this->whenLoaded('student', fn () => $this->student ? [
                'id' => $this->student->id,
                'name' => $this->student->name,
                'email' => $this->student->email,
            ] : null),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
