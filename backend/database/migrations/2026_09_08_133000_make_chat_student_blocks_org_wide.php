<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('chat_student_blocks', function (Blueprint $table) {
            $table->dropUnique(['student_id', 'department']);
        });

        // One block per student covers every department / all staff.
        $keepIds = DB::table('chat_student_blocks')
            ->selectRaw('min(id) as id')
            ->groupBy('student_id')
            ->pluck('id');

        DB::table('chat_student_blocks')->whereNotIn('id', $keepIds)->delete();

        DB::table('chat_student_blocks')->update(['department' => null]);

        Schema::table('chat_student_blocks', function (Blueprint $table) {
            $table->unique('student_id');
        });
    }

    public function down(): void
    {
        Schema::table('chat_student_blocks', function (Blueprint $table) {
            $table->dropUnique(['student_id']);
        });

        Schema::table('chat_student_blocks', function (Blueprint $table) {
            $table->unique(['student_id', 'department']);
        });
    }
};
