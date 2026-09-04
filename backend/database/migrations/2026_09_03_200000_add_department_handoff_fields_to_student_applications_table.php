<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_applications', function (Blueprint $table) {
            // Each stamp marks the moment the next department was handed the student,
            // so the hand-off notification is only sent once per milestone.
            $table->timestamp('documents_approved_at')->nullable()->after('everything_accepted');
            $table->timestamp('universities_shared_at')->nullable()->after('documents_approved_at');
            $table->timestamp('fees_cleared_at')->nullable()->after('universities_shared_at');
        });
    }

    public function down(): void
    {
        Schema::table('student_applications', function (Blueprint $table) {
            $table->dropColumn([
                'documents_approved_at',
                'universities_shared_at',
                'fees_cleared_at',
            ]);
        });
    }
};
