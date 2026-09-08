<?php

namespace App\Models;

use App\Enums\DocumentType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'consultant_id',
    'name',
    'country',
    'city',
    'description',
    'is_visible_to_students',
])]
class University extends Model
{
    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_visible_to_students' => 'boolean',
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
     * @return HasMany<UniversityRequiredDocument, $this>
     */
    public function requiredDocuments(): HasMany
    {
        return $this->hasMany(UniversityRequiredDocument::class);
    }

    /**
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany<User, $this>
     */
    public function assignedStudents(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(User::class, 'student_university', 'university_id', 'student_id')
            ->withPivot(['assigned_by', 'notes', 'source'])
            ->withTimestamps();
    }

    /**
     * Replace the required document list for this university.
     *
     * @param  list<string>  $documentTypes
     */
    public function syncRequiredDocumentTypes(array $documentTypes): void
    {
        $uniqueTypes = collect($documentTypes)
            ->map(fn (string $type) => DocumentType::from($type))
            ->unique(fn (DocumentType $type) => $type->value)
            ->values();

        $this->requiredDocuments()->delete();

        foreach ($uniqueTypes as $type) {
            $this->requiredDocuments()->create([
                'document_type' => $type,
            ]);
        }
    }
}
