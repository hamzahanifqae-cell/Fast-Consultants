<?php

namespace App\Http\Requests\Api;

use App\Enums\Gender;
use App\Enums\InformationCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStudentProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'phone' => ['required', 'string', 'max:30'],
            'date_of_birth' => ['required', 'date', 'before:today'],
            'gender' => ['required', Rule::enum(Gender::class)],
            'nationality' => ['required', 'string', 'max:100'],
            'country_of_residence' => ['required', 'string', 'max:100'],
            'city' => ['required', 'string', 'max:100'],
            'address' => ['required', 'string', 'max:500'],
            'passport_number' => ['required', 'string', 'max:50'],
            'cnic_number' => ['required', 'string', 'max:20', 'regex:/^[0-9]{5}-?[0-9]{7}-?[0-9]$/'],
            'information_category' => ['required', Rule::enum(InformationCategory::class)],
            'education_level' => ['required', 'string', 'max:100'],
            'institution_name' => ['required', 'string', 'max:255'],
            'field_of_study' => ['required', 'string', 'max:255'],
            'graduation_year' => ['required', 'string', 'max:10'],
            'job_title' => ['required', 'string', 'max:255'],
            'employer_name' => ['required', 'string', 'max:255'],
            'years_of_experience' => ['required', 'string', 'max:20'],
            'other_information' => ['required', 'string', 'max:2000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'cnic_number.regex' => 'Enter a valid CNIC number (e.g. 12345-1234567-1).',
            'information_category.required' => 'Select a section to edit.',
            'education_level.required' => 'Education level is required.',
            'institution_name.required' => 'Institution name is required.',
            'field_of_study.required' => 'Field of study is required.',
            'graduation_year.required' => 'Graduation year is required.',
            'job_title.required' => 'Job title is required.',
            'employer_name.required' => 'Employer name is required.',
            'years_of_experience.required' => 'Years of experience is required.',
            'other_information.required' => 'Other information is required.',
        ];
    }
}
