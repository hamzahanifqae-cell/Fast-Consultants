<?php

namespace App\Models;

use App\Enums\LeadClassification;
use App\Enums\LeadStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Lead extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'name',
        'email',
        'phone',
        'city',
        'preferred_country',
        'study_level',
        'education_level',
        'intended_program',
        'budget_range',
        'preferred_intake',
        'intake_year',
        'qualification',
        'grade',
        'english_status',
        'english_score',
        'services',
        'contact_method',
        'contact_time',
        'timeline',
        'message',
        'source',
        'status',
        'classification',
        'classification_score',
        'classification_reason',
        'classification_model',
        'classified_at',
        'converted_user_id',
        'converted_by',
        'converted_at',
        'dismissed_by',
        'dismissed_at',
        'staff_notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => LeadStatus::class,
            'classification' => LeadClassification::class,
            'classification_score' => 'integer',
            'services' => 'array',
            'classified_at' => 'datetime',
            'converted_at' => 'datetime',
            'dismissed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function convertedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'converted_user_id');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function convertedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'converted_by');
    }
}
