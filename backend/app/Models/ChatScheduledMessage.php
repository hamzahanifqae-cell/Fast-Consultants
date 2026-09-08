<?php

namespace App\Models;

use App\Enums\StaffDepartment;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'sender_id',
    'type',
    'conversation_id',
    'body',
    'attachment_path',
    'attachment_original_name',
    'attachment_mime_type',
    'attachment_size',
    'broadcast_student_ids',
    'broadcast_department',
    'scheduled_at',
    'sent_at',
    'status',
    'error_message',
])]
class ChatScheduledMessage extends Model
{
    public const TYPE_CONVERSATION = 'conversation';

    public const TYPE_BROADCAST = 'broadcast';

    public const STATUS_PENDING = 'pending';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'broadcast_student_ids' => 'array',
            'broadcast_department' => StaffDepartment::class,
            'scheduled_at' => 'datetime',
            'sent_at' => 'datetime',
            'attachment_size' => 'integer',
        ];
    }

    public function hasAttachment(): bool
    {
        return filled($this->attachment_path);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * @return BelongsTo<ChatConversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(ChatConversation::class, 'conversation_id');
    }

    /**
     * @return array{path: string, original_name: string, mime_type: string|null, size: int|null}|null
     */
    public function attachmentMeta(): ?array
    {
        if (! $this->hasAttachment()) {
            return null;
        }

        return [
            'path' => (string) $this->attachment_path,
            'original_name' => (string) ($this->attachment_original_name ?: 'attachment'),
            'mime_type' => $this->attachment_mime_type,
            'size' => $this->attachment_size,
        ];
    }
}
