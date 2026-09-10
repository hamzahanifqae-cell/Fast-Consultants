<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->string('city')->nullable()->after('phone');
            $table->string('study_level')->nullable()->after('preferred_country');
            $table->string('intake_year')->nullable()->after('preferred_intake');
            $table->string('qualification')->nullable()->after('education_level');
            $table->string('grade')->nullable()->after('qualification');
            $table->string('english_status')->nullable()->after('grade');
            $table->string('english_score')->nullable()->after('english_status');
            $table->json('services')->nullable()->after('budget_range');
            $table->string('contact_method')->nullable()->after('services');
            $table->string('contact_time')->nullable()->after('contact_method');
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn([
                'city',
                'study_level',
                'intake_year',
                'qualification',
                'grade',
                'english_status',
                'english_score',
                'services',
                'contact_method',
                'contact_time',
            ]);
        });
    }
};
