<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->string('kind')->default('student_department')->after('id');
            $table->foreignId('staff_low_id')->nullable()->after('department')->constrained('users')->nullOnDelete();
            $table->foreignId('staff_high_id')->nullable()->after('staff_low_id')->constrained('users')->nullOnDelete();
        });

        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropForeign(['student_id']);
        });

        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->unsignedBigInteger('student_id')->nullable()->change();
            $table->foreign('student_id')->references('id')->on('users')->nullOnDelete();
            $table->unique(['staff_low_id', 'staff_high_id']);
        });
    }

    public function down(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropUnique(['staff_low_id', 'staff_high_id']);
            $table->dropForeign(['staff_low_id']);
            $table->dropForeign(['staff_high_id']);
            $table->dropForeign(['student_id']);
            $table->dropColumn(['kind', 'staff_low_id', 'staff_high_id']);
        });

        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->unsignedBigInteger('student_id')->nullable(false)->change();
            $table->foreign('student_id')->references('id')->on('users')->cascadeOnDelete();
        });
    }
};
