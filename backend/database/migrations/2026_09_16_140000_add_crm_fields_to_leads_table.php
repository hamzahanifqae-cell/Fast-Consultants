<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->string('visa_refusal')->nullable()->after('city');
            $table->string('marital_status')->nullable()->after('visa_refusal');
            $table->date('date_of_birth')->nullable()->after('marital_status');
            $table->string('whatsapp')->nullable()->after('phone');
            $table->string('address')->nullable()->after('city');
            $table->string('passing_year')->nullable()->after('grade');
            $table->text('travel_history')->nullable()->after('english_score');
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropColumn([
                'visa_refusal',
                'marital_status',
                'date_of_birth',
                'whatsapp',
                'address',
                'passing_year',
                'travel_history',
            ]);
        });
    }
};
