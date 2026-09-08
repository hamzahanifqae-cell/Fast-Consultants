<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // File-based assignments are incompatible with in-app letters.
        DB::table('form_template_assignments')->delete();

        Schema::table('form_template_assignments', function (Blueprint $table) {
            $table->string('template_key', 64)->default('sponsorship_letter')->after('sent_by');
            $table->json('answers')->nullable()->after('instructions');
        });

        Schema::table('form_template_assignments', function (Blueprint $table) {
            $table->dropColumn([
                'template_original_name',
                'template_path',
                'template_mime_type',
                'template_file_size',
                'filled_original_name',
                'filled_path',
                'filled_mime_type',
                'filled_file_size',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('form_template_assignments', function (Blueprint $table) {
            $table->string('template_original_name')->nullable();
            $table->string('template_path')->nullable();
            $table->string('template_mime_type')->nullable();
            $table->unsignedBigInteger('template_file_size')->nullable();
            $table->string('filled_original_name')->nullable();
            $table->string('filled_path')->nullable();
            $table->string('filled_mime_type')->nullable();
            $table->unsignedBigInteger('filled_file_size')->nullable();
        });

        Schema::table('form_template_assignments', function (Blueprint $table) {
            $table->dropColumn(['template_key', 'answers']);
        });
    }
};
