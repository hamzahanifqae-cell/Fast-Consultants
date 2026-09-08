<?php

namespace App\Console\Commands;

use App\Enums\Role;
use App\Models\ChargeReceipt;
use App\Models\ChatConversation;
use App\Models\ChatStudentBlock;
use App\Models\Question;
use App\Models\StudentApplication;
use App\Models\StudentDocument;
use App\Models\StudentNotification;
use App\Models\StudentProfile;
use App\Models\User;
use App\Models\UserNotification;
use App\Models\VisaAppointment;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;

class ClearStudentDataCommand extends Command
{
    protected $signature = 'app:clear-student-data
                            {--force : Skip confirmation}
                            {--with-catalog : Also wipe universities and departments catalog}';

    protected $description = 'Delete all student accounts and operational data; keep Super Admin / Admin / Staff credentials.';

    public function handle(): int
    {
        $orgRoles = array_map(
            static fn (Role $role) => $role->value,
            Role::organizationRoles(),
        );

        $students = User::role(Role::Student->value)->get();
        $kept = User::role($orgRoles)->get();

        $this->info('Will KEEP organization accounts:');
        foreach ($kept as $user) {
            $roles = $user->getRoleNames()->implode(', ');
            $this->line("  - {$user->email} ({$roles})");
        }

        $this->newLine();
        $this->warn("Will DELETE {$students->count()} student account(s) and related operational data.");

        if ($this->option('with-catalog')) {
            $this->warn('Also wiping universities / departments catalog (--with-catalog).');
        }

        if (! $this->option('force') && ! $this->confirm('Continue?', false)) {
            $this->info('Cancelled.');

            return self::SUCCESS;
        }

        DB::transaction(function () use ($students): void {
            // Delete uploaded files before rows cascade away.
            StudentDocument::query()->each(function (StudentDocument $document): void {
                $document->deleteFile();
            });

            ChargeReceipt::query()->each(function (ChargeReceipt $receipt): void {
                $receipt->deleteConsultantFile();
                $receipt->deleteStudentFile();
            });

            // Explicit cleanup for tables that may retain staff-only leftovers.
            ChatConversation::query()->delete();
            ChatStudentBlock::query()->delete();
            Question::query()->delete();
            StudentApplication::query()->delete();
            VisaAppointment::query()->delete();
            StudentNotification::query()->delete();
            UserNotification::query()->delete();
            ChargeReceipt::query()->delete();
            StudentDocument::query()->delete();
            StudentProfile::query()->delete();
            DB::table('student_university')->delete();

            foreach ($students as $student) {
                PersonalAccessToken::query()
                    ->where('tokenable_type', User::class)
                    ->where('tokenable_id', $student->id)
                    ->delete();

                $student->delete();
            }

            if ($this->option('with-catalog')) {
                DB::table('university_required_documents')->delete();
                DB::table('universities')->delete();
                DB::table('departments')->delete();
            }
        });

        $remainingStudents = User::role(Role::Student->value)->count();
        $remainingOrg = User::role($orgRoles)->count();

        $this->newLine();
        $this->info('Done.');
        $this->line("  Organization accounts remaining: {$remainingOrg}");
        $this->line("  Student accounts remaining: {$remainingStudents}");

        return self::SUCCESS;
    }
}
