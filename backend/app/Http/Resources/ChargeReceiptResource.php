<?php

namespace App\Http\Resources;

use App\Models\ChargeReceipt;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin ChargeReceipt
 */
class ChargeReceiptResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'amount' => $this->amount,
            'currency' => $this->currency,
            'notes' => $this->notes,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'rejection_reason' => $this->rejection_reason,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(),
            'consultant_file' => [
                'original_name' => $this->consultant_original_name,
                'mime_type' => $this->consultant_mime_type,
                'file_size' => $this->consultant_file_size,
            ],
            'student_file' => $this->student_file_path ? [
                'original_name' => $this->student_original_name,
                'mime_type' => $this->student_mime_type,
                'file_size' => $this->student_file_size,
            ] : null,
            'consultant' => $this->whenLoaded('consultant', fn () => [
                'id' => $this->consultant->id,
                'name' => $this->consultant->name,
                'email' => $this->consultant->email,
            ]),
            'student' => $this->whenLoaded('student', fn () => [
                'id' => $this->student->id,
                'name' => $this->student->name,
                'email' => $this->student->email,
            ]),
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
