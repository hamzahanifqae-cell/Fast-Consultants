<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_applications', function (Blueprint $table) {
            $table->string('interview_followup_preference')->nullable()->after('interview_staff_joined_at');
            $table->timestamp('interview_followup_preference_at')->nullable()->after('interview_followup_preference');
            $table->timestamp('interview_meeting_ended_at')->nullable()->after('interview_followup_preference_at');
        });
    }

    public function down(): void
    {
        Schema::table('student_applications', function (Blueprint $table) {
            $table->dropColumn([
                'interview_followup_preference',
                'interview_followup_preference_at',
                'interview_meeting_ended_at',
            ]);
        });
    }
};
