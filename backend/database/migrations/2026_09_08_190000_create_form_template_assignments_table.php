<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('form_template_assignments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('student_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('sent_by')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->text('instructions')->nullable();
            $table->string('template_original_name');
            $table->string('template_path');
            $table->string('template_mime_type')->nullable();
            $table->unsignedBigInteger('template_file_size')->default(0);
            $table->string('filled_original_name')->nullable();
            $table->string('filled_path')->nullable();
            $table->string('filled_mime_type')->nullable();
            $table->unsignedBigInteger('filled_file_size')->nullable();
            $table->string('status', 32)->default('awaiting_student');
            $table->string('rejection_reason')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['student_id', 'status']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_template_assignments');
    }
};
