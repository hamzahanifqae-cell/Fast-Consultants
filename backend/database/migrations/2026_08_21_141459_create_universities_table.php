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
        Schema::create('universities', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consultant_id')->constrained('users')->cascadeOnDelete();
            $table->string('name');
            $table->string('country');
            $table->string('city')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_visible_to_students')->default(true);
            $table->timestamps();

            $table->index(['is_visible_to_students', 'consultant_id']);
        });

        Schema::create('university_required_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('university_id')->constrained()->cascadeOnDelete();
            $table->string('document_type');
            $table->timestamps();

            $table->unique(['university_id', 'document_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('university_required_documents');
        Schema::dropIfExists('universities');
    }
};
