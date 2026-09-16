<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('universities', function (Blueprint $table) {
            $table->boolean('listed_in_catalog')
                ->default(true)
                ->after('is_visible_to_students');

            $table->index('listed_in_catalog');
        });

        // Universities created when staff accepted a student suggestion should stay
        // off the shared catalog (assignment to that student still works).
        if (Schema::hasTable('university_suggestions')) {
            $ids = DB::table('university_suggestions as suggestions')
                ->join('universities as universities', 'universities.id', '=', 'suggestions.university_id')
                ->whereNotNull('suggestions.university_id')
                ->whereColumn('universities.created_at', '>=', 'suggestions.created_at')
                ->pluck('universities.id')
                ->unique()
                ->all();

            if ($ids !== []) {
                DB::table('universities')
                    ->whereIn('id', $ids)
                    ->update([
                        'listed_in_catalog' => false,
                        'is_visible_to_students' => false,
                    ]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('universities', function (Blueprint $table) {
            $table->dropIndex(['listed_in_catalog']);
            $table->dropColumn('listed_in_catalog');
        });
    }
};
