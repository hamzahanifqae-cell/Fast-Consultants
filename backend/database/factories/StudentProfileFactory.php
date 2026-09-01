<?php

namespace Database\Factories;

use App\Enums\Gender;
use App\Models\StudentProfile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StudentProfile>
 */
class StudentProfileFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'phone' => fake()->e164PhoneNumber(),
            'date_of_birth' => fake()->dateTimeBetween('-30 years', '-16 years')->format('Y-m-d'),
            'gender' => fake()->randomElement(Gender::cases()),
            'nationality' => fake()->country(),
            'country_of_residence' => fake()->country(),
            'city' => fake()->city(),
            'address' => fake()->streetAddress(),
            'passport_number' => strtoupper(fake()->bothify('??######')),
            'cnic_number' => fake()->numerify('#####-#######-#'),
            'information_category' => 'education',
            'education_level' => 'Bachelor\'s',
            'institution_name' => fake()->company().' University',
            'field_of_study' => 'Computer Science',
            'graduation_year' => (string) fake()->numberBetween(2018, 2025),
        ];
    }
}
