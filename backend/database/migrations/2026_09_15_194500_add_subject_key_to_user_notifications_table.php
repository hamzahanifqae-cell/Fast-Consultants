<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('user_notifications', function (Blueprint $table) {
            $table->string('subject_key')->nullable()->after('action');
            $table->index(['user_id', 'subject_key', 'read_at']);
        });
    }

    public function down(): void
    {
        Schema::table('user_notifications', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'subject_key', 'read_at']);
            $table->dropColumn('subject_key');
        });
    }
};
