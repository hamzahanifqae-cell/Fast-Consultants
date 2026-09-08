<?php

namespace App\Models;

use App\Enums\StaffDepartment;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'kind',
    'student_id',
    'consultant_id',
    'department',
    'staff_low_id',
    'staff_high_id',
    'last_message_at',
])]
class ChatConversation extends Model
{
    public const KIND_STUDENT_DEPARTMENT = 'student_department';

    public const KIND_STAFF_DM = 'staff_dm';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'last_message_at' => 'datetime',
            'department' => StaffDepartment::class,
        ];
    }

    public function isStaffDm(): bool
    {
        return $this->kind === self::KIND_STAFF_DM;
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(User::class, 'student_id');
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
    public function staffLow(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_low_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function staffHigh(): BelongsTo
    {
        return $this->belongsTo(User::class, 'staff_high_id');
    }

    public function staffPeerFor(User $viewer): ?User
    {
        if (! $this->isStaffDm()) {
            return null;
        }

        if ($viewer->id === $this->staff_low_id) {
            return $this->staffHigh;
        }

        if ($viewer->id === $this->staff_high_id) {
            return $this->staffLow;
        }

        return null;
    }

    public function includesStaff(int $userId): bool
    {
        return $this->isStaffDm()
            && ($this->staff_low_id === $userId || $this->staff_high_id === $userId);
    }

    /**
     * @return HasMany<ChatMessage, $this>
     */
    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class, 'conversation_id')->oldest();
    }

    /**
     * @return HasMany<ChatConversationRead, $this>
     */
    public function reads(): HasMany
    {
        return $this->hasMany(ChatConversationRead::class, 'conversation_id');
    }

    /**
     * @return HasOne<ChatMessage, $this>
     */
    public function latestMessage(): HasOne
    {
        return $this->hasOne(ChatMessage::class, 'conversation_id')->latestOfMany();
    }

    /**
     * @return array{0: int, 1: int}
     */
    public static function orderedStaffPair(int $a, int $b): array
    {
        return $a < $b ? [$a, $b] : [$b, $a];
    }
}
