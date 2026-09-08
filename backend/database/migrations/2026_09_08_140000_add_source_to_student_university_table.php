<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('student_university', function (Blueprint $table) {
            $table->string('source', 32)->default('staff_shared')->after('assigned_by');
        });
    }

    public function down(): void
    {
        Schema::table('student_university', function (Blueprint $table) {
            $table->dropColumn('source');
        });
    }
};
