<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('student_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->foreignId('consultant_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('stage')->default('documents_and_charges');
            $table->boolean('everything_accepted')->default(false);

            $table->string('preparation_title')->nullable();
            $table->text('preparation_body')->nullable();
            $table->timestamp('preparation_unlocked_at')->nullable();
            $table->timestamp('preparation_completed_at')->nullable();

            $table->timestamp('interview_at')->nullable();
            $table->string('interview_mode')->nullable();
            $table->string('interview_location')->nullable();
            $table->text('interview_notes')->nullable();
            $table->string('interview_status')->default('not_scheduled');
            $table->timestamp('interview_unlocked_at')->nullable();

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_applications');
    }
};
