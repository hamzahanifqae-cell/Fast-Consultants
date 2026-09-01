<?php

namespace App\Http\Resources;

use App\Models\University;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin University
 */
class UniversityResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'country' => $this->country,
            'city' => $this->city,
            'description' => $this->description,
            'is_visible_to_students' => $this->is_visible_to_students,
            'required_documents' => $this->whenLoaded('requiredDocuments', fn () => $this->requiredDocuments
                ->map(fn ($requirement) => [
                    'type' => $requirement->document_type->value,
                    'label' => $requirement->document_type->label(),
                ])
                ->values()
                ->all()),
            'consultant' => $this->whenLoaded('consultant', fn () => [
                'id' => $this->consultant->id,
                'name' => $this->consultant->name,
                'email' => $this->consultant->email,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
