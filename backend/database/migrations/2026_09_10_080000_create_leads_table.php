<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('phone')->nullable();
            $table->string('preferred_country')->nullable();
            $table->string('education_level')->nullable();
            $table->string('intended_program')->nullable();
            $table->string('budget_range')->nullable();
            $table->string('preferred_intake')->nullable();
            $table->string('timeline')->nullable();
            $table->text('message')->nullable();
            $table->string('source')->nullable();
            $table->string('status')->default('new')->index();
            $table->string('classification')->nullable()->index();
            $table->unsignedTinyInteger('classification_score')->nullable();
            $table->text('classification_reason')->nullable();
            $table->string('classification_model')->nullable();
            $table->timestamp('classified_at')->nullable();
            $table->foreignId('converted_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('converted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('converted_at')->nullable();
            $table->foreignId('dismissed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('dismissed_at')->nullable();
            $table->text('staff_notes')->nullable();
            $table->timestamps();

            $table->index('email');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
