<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_applications', function (Blueprint $table) {
            $table->timestamp('interview_student_joined_at')->nullable()->after('interview_starting_sent_at');
            $table->timestamp('interview_staff_joined_at')->nullable()->after('interview_student_joined_at');
        });
    }

    public function down(): void
    {
        Schema::table('student_applications', function (Blueprint $table) {
            $table->dropColumn(['interview_student_joined_at', 'interview_staff_joined_at']);
        });
    }
};
