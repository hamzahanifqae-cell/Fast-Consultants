<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_applications', function (Blueprint $table) {
            $table->timestamp('interview_reminder_1h_sent_at')->nullable()->after('interview_unlocked_at');
            $table->timestamp('interview_reminder_15m_sent_at')->nullable()->after('interview_reminder_1h_sent_at');
            $table->timestamp('interview_starting_sent_at')->nullable()->after('interview_reminder_15m_sent_at');
        });
    }

    public function down(): void
    {
        Schema::table('student_applications', function (Blueprint $table) {
            $table->dropColumn([
                'interview_reminder_1h_sent_at',
                'interview_reminder_15m_sent_at',
                'interview_starting_sent_at',
            ]);
        });
    }
};
