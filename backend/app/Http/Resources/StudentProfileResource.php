<?php

namespace App\Http\Resources;

use App\Models\StudentProfile;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin StudentProfile
 */
class StudentProfileResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'name' => $this->user?->name,
            'email' => $this->user?->email,
            'phone' => $this->phone,
            'date_of_birth' => $this->date_of_birth?->format('Y-m-d'),
            'gender' => $this->gender?->value,
            'nationality' => $this->nationality,
            'country_of_residence' => $this->country_of_residence,
            'city' => $this->city,
            'address' => $this->address,
            'passport_number' => $this->passport_number,
            'cnic_number' => $this->cnic_number,
            'information_category' => $this->information_category?->value,
            'education_level' => $this->education_level,
            'institution_name' => $this->institution_name,
            'field_of_study' => $this->field_of_study,
            'graduation_year' => $this->graduation_year,
            'job_title' => $this->job_title,
            'employer_name' => $this->employer_name,
            'years_of_experience' => $this->years_of_experience,
            'other_information' => $this->other_information,
        ];
    }
}
