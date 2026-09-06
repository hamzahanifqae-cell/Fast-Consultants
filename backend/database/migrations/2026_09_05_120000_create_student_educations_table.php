<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('student_educations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_profile_id')->constrained('student_profiles')->cascadeOnDelete();
            $table->string('education_level');
            $table->string('institution_name');
            $table->string('field_of_study');
            $table->string('graduation_year', 10);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        // Carry existing single-education profiles into the new table.
        $profiles = DB::table('student_profiles')
            ->whereNotNull('education_level')
            ->where('education_level', '!=', '')
            ->get(['id', 'education_level', 'institution_name', 'field_of_study', 'graduation_year']);

        $now = now();
        foreach ($profiles as $profile) {
            DB::table('student_educations')->insert([
                'student_profile_id' => $profile->id,
                'education_level' => $profile->education_level,
                'institution_name' => $profile->institution_name ?? '',
                'field_of_study' => $profile->field_of_study ?? '',
                'graduation_year' => $profile->graduation_year ?? '',
                'sort_order' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('student_educations');
    }
};
