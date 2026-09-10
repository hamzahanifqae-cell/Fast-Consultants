<?php

namespace App\Console\Commands;

use App\Enums\InterviewStatus;
use App\Models\StudentApplication;
use App\Services\StudentNotificationService;
use App\Support\DisplayTime;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class SendInterviewReminders extends Command
{
    protected $signature = 'interview:send-reminders';

    protected $description = 'Send in-app interview reminders to students (1 hour, 15 minutes, and at start time).';

    public function __construct(
        private readonly StudentNotificationService $notifications,
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $now = now();
        $sent = 0;

        // Catch-up windows so a missed cron minute still delivers the reminder once.
        $sent += $this->sendDueReminders(
            column: 'interview_reminder_1h_sent_at',
            dueBy: $now->copy()->addHour(),
            notAfter: $now->copy()->addMinutes(20),
            type: 'interview_reminder',
            message: fn (Carbon $at) => 'Interview reminder: your session starts in about 1 hour ('
                .DisplayTime::format($at, 'M j, g:i A').').',
        );

        $sent += $this->sendDueReminders(
            column: 'interview_reminder_15m_sent_at',
            dueBy: $now->copy()->addMinutes(15),
            notAfter: $now->copy()->addMinutes(2),
            type: 'interview_reminder_urgent',
            message: fn (Carbon $at) => 'Interview starting soon, 15 minutes until '
                .DisplayTime::format($at, 'g:i A')
                .'. Join your prep video call now.',
        );

        $sent += $this->sendDueReminders(
            column: 'interview_starting_sent_at',
            dueBy: $now->copy()->addMinute(),
            notAfter: $now->copy()->subMinutes(5),
            type: 'interview_starting',
            message: fn (Carbon $at) => 'Your interview preparation session is starting now ('
                .DisplayTime::format($at, 'g:i A')
                .'). Open Interview to join the video call.',
            allowPast: true,
        );

        $this->info("Sent {$sent} interview reminder(s).");

        return self::SUCCESS;
    }

    /**
     * @param  callable(Carbon): string  $message
     */
    private function sendDueReminders(
        string $column,
        Carbon $dueBy,
        Carbon $notAfter,
        string $type,
        callable $message,
        bool $allowPast = false,
    ): int {
        $applications = StudentApplication::query()
            ->with('student:id,name,email')
            ->whereNotNull('interview_at')
            ->whereNull($column)
            ->where('interview_status', InterviewStatus::Scheduled)
            ->where('interview_at', '<=', $dueBy)
            ->when(
                $allowPast,
                fn ($query) => $query->where('interview_at', '>=', $notAfter),
                fn ($query) => $query->where('interview_at', '>', $notAfter),
            )
            ->get();

        foreach ($applications as $application) {
            $student = $application->student;
            if (! $student) {
                continue;
            }

            $this->notifications->createForStudent(
                $student,
                null,
                $message($application->interview_at),
                $type,
                '/student-interview',
            );

            $application->forceFill([$column => now()])->save();
        }

        return $applications->count();
    }
}
