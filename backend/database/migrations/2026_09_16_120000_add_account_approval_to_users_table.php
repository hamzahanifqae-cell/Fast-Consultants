<?php

use App\Enums\AccountApprovalStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('account_approval_status')->nullable()->after('staff_department');
            $table->timestamp('account_approved_at')->nullable()->after('account_approval_status');
            $table->foreignId('account_reviewed_by')->nullable()->after('account_approved_at')->constrained('users')->nullOnDelete();
            $table->text('account_rejection_reason')->nullable()->after('account_reviewed_by');
            $table->index('account_approval_status');
        });

        // Existing accounts can keep signing in.
        DB::table('users')->update([
            'account_approval_status' => AccountApprovalStatus::Approved->value,
            'account_approved_at' => now(),
        ]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropConstrainedForeignId('account_reviewed_by');
            $table->dropIndex(['account_approval_status']);
            $table->dropColumn([
                'account_approval_status',
                'account_approved_at',
                'account_rejection_reason',
            ]);
        });
    }
};
