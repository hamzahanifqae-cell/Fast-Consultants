<?php

namespace App\Models;

use App\Enums\Gender;
use App\Enums\InformationCategory;
use Database\Factories\StudentProfileFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'user_id',
    'phone',
    'date_of_birth',
    'gender',
    'nationality',
    'country_of_residence',
    'city',
    'address',
    'passport_number',
    'cnic_number',
    'information_category',
    'education_level',
    'institution_name',
    'field_of_study',
    'graduation_year',
    'job_title',
    'employer_name',
    'years_of_experience',
    'other_information',
])]
class StudentProfile extends Model
{
    /** @use HasFactory<StudentProfileFactory> */
    use HasFactory;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'gender' => Gender::class,
            'information_category' => InformationCategory::class,
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
     * @return HasMany<StudentEducation, $this>
     */
    public function educations(): HasMany
    {
        return $this->hasMany(StudentEducation::class)->orderBy('sort_order')->orderBy('id');
    }
}
