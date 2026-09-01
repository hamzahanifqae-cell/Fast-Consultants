<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type')->nullable();
            $table->text('message');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read_at']);
        });

        if (Schema::hasTable('student_notifications')) {
            $rows = DB::table('student_notifications')->orderBy('id')->get();

            foreach ($rows as $row) {
                DB::table('user_notifications')->insert([
                    'user_id' => $row->student_id,
                    'actor_id' => $row->consultant_id,
                    'type' => $row->type,
                    'message' => $row->message,
                    'read_at' => $row->read_at,
                    'created_at' => $row->created_at,
                    'updated_at' => $row->updated_at,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('user_notifications');
    }
};
