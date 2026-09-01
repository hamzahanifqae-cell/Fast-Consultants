<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropUnique(['student_id', 'consultant_id']);
        });

        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->string('department')->nullable()->after('consultant_id');
            $table->unsignedBigInteger('consultant_id')->nullable()->change();
            $table->unique(['student_id', 'department']);
        });
    }

    public function down(): void
    {
        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropUnique(['student_id', 'department']);
        });

        Schema::table('chat_conversations', function (Blueprint $table) {
            $table->dropColumn('department');
            $table->unsignedBigInteger('consultant_id')->nullable(false)->change();
            $table->unique(['student_id', 'consultant_id']);
        });
    }
};
