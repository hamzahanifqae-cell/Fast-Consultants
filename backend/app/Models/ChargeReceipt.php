<?php

namespace App\Models;

use App\Enums\ChargeReceiptStatus;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Support\UploadStorage;

#[Fillable([
    'consultant_id',
    'student_id',
    'title',
    'amount',
    'currency',
    'notes',
    'consultant_original_name',
    'consultant_file_path',
    'consultant_mime_type',
    'consultant_file_size',
    'student_original_name',
    'student_file_path',
    'student_mime_type',
    'student_file_size',
    'status',
    'rejection_reason',
    'reviewed_at',
])]
class ChargeReceipt extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => ChargeReceiptStatus::class,
            'amount' => 'decimal:2',
            'consultant_file_size' => 'integer',
            'student_file_size' => 'integer',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function consultant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'consultant_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
    }

    public function deleteConsultantFile(): void
    {
        if ($this->consultant_file_path && UploadStorage::disk()->exists($this->consultant_file_path)) {
            UploadStorage::disk()->delete($this->consultant_file_path);
        }
    }

    public function deleteStudentFile(): void
    {
        if ($this->student_file_path && UploadStorage::disk()->exists($this->student_file_path)) {
            UploadStorage::disk()->delete($this->student_file_path);
        }
    }
}
