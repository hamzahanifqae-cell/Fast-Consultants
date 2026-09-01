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
        Schema::create('charge_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultant_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->decimal('amount', 12, 2)->nullable();
            $table->string('currency', 10)->nullable();
            $table->text('notes')->nullable();

            $table->string('consultant_original_name');
            $table->string('consultant_file_path');
            $table->string('consultant_mime_type')->nullable();
            $table->unsignedBigInteger('consultant_file_size')->default(0);

            $table->string('student_original_name')->nullable();
            $table->string('student_file_path')->nullable();
            $table->string('student_mime_type')->nullable();
            $table->unsignedBigInteger('student_file_size')->nullable();

            $table->string('status')->default('awaiting_student');
            $table->string('rejection_reason')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['consultant_id', 'status']);
            $table->index(['student_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('charge_receipts');
    }
};
