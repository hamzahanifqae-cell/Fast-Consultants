<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->string('information_category')->nullable()->after('cnic_number');
            $table->string('education_level')->nullable()->after('information_category');
            $table->string('institution_name')->nullable()->after('education_level');
            $table->string('field_of_study')->nullable()->after('institution_name');
            $table->string('graduation_year', 10)->nullable()->after('field_of_study');
            $table->string('job_title')->nullable()->after('graduation_year');
            $table->string('employer_name')->nullable()->after('job_title');
            $table->string('years_of_experience', 20)->nullable()->after('employer_name');
            $table->text('other_information')->nullable()->after('years_of_experience');
        });
    }

    public function down(): void
    {
        Schema::table('student_profiles', function (Blueprint $table) {
            $table->dropColumn([
                'information_category',
                'education_level',
                'institution_name',
                'field_of_study',
                'graduation_year',
                'job_title',
                'employer_name',
                'years_of_experience',
                'other_information',
            ]);
        });
    }
};
