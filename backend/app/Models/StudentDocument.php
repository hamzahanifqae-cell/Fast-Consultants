<?php

namespace App\Models;

use App\Enums\DocumentStatus;
use App\Enums\DocumentType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Support\UploadStorage;

#[Fillable([
    'user_id',
    'type',
    'title',
    'original_name',
    'file_path',
    'mime_type',
    'file_size',
    'status',
    'reviewed_by',
    'reviewed_at',
    'rejection_reason',
])]
class StudentDocument extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'type' => DocumentType::class,
            'status' => DocumentStatus::class,
            'file_size' => 'integer',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function deleteFile(): void
    {
        if ($this->file_path && UploadStorage::disk()->exists($this->file_path)) {
            UploadStorage::disk()->delete($this->file_path);
        }
    }
}
