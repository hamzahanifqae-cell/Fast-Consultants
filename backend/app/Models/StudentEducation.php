<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'student_profile_id',
    'education_level',
    'institution_name',
    'field_of_study',
    'graduation_year',
    'sort_order',
])]
class StudentEducation extends Model
{
    protected $table = 'student_educations';

    /**
     * @return BelongsTo<StudentProfile, $this>
     */
    public function profile(): BelongsTo
    {
        return $this->belongsTo(StudentProfile::class, 'student_profile_id');
    }
}
