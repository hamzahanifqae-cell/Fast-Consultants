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
            $table->dropUnique(['student_id']);
        });

        Schema::table('chat_student_blocks', function (Blueprint $table) {
            $table->string('department')->nullable()->after('student_id');
        });

        // Blocks used to be global. Keep each one applying to the department of the
        // staff member who created it so it no longer covers every department.
        DB::table('chat_student_blocks')
            ->whereNull('department')
            ->whereNotNull('blocked_by')
            ->update([
                'department' => DB::raw(
                    '(select department from users where users.id = chat_student_blocks.blocked_by)'
                ),
            ]);

        Schema::table('chat_student_blocks', function (Blueprint $table) {
            $table->unique(['student_id', 'department']);
        });
    }

    public function down(): void
    {
        Schema::table('chat_student_blocks', function (Blueprint $table) {
            $table->dropUnique(['student_id', 'department']);
        });

        // The old unique index allows a single row per student.
        $keepIds = DB::table('chat_student_blocks')
            ->selectRaw('min(id) as id')
            ->groupBy('student_id')
            ->pluck('id');

        DB::table('chat_student_blocks')->whereNotIn('id', $keepIds)->delete();

        Schema::table('chat_student_blocks', function (Blueprint $table) {
            $table->dropColumn('department');
            $table->unique('student_id');
        });
    }
};
