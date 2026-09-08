<?php

namespace App\Models;

use App\Enums\FormTemplateStatus;
use App\Support\FormTemplates\FormTemplateCatalog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FormTemplateAssignment extends Model
{
    /** @var list<string> */
    protected $fillable = [
        'student_id',
        'sent_by',
        'template_key',
        'title',
        'instructions',
        'answers',
        'status',
        'rejection_reason',
        'reviewed_by',
        'reviewed_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => FormTemplateStatus::class,
            'answers' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    /**
     * @return array{
     *     key: string,
     *     title: string,
     *     letter_body: string,
     *     fields: list<array{key: string, label: string, type: string, required: bool}>
     * }|null
     */
    public function templateDefinition(): ?array
    {
        return FormTemplateCatalog::find($this->template_key);
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
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
