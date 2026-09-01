<?php

namespace App\Console\Commands;

use App\Enums\InterviewStatus;
use App\Models\StudentApplication;
use App\Services\StudentNotificationService;
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

        $sent += $this->sendWindowReminders(
            column: 'interview_reminder_1h_sent_at',
            from: $now->copy()->addMinutes(59),
            to: $now->copy()->addMinutes(61),
            type: 'interview_reminder',
            message: fn (Carbon $at) => 'Interview reminder: your session starts in about 1 hour ('.$at->format('M j, g:i A').').',
        );

        $sent += $this->sendWindowReminders(
            column: 'interview_reminder_15m_sent_at',
            from: $now->copy()->addMinutes(14),
            to: $now->copy()->addMinutes(16),
            type: 'interview_reminder_urgent',
            message: fn (Carbon $at) => 'Interview starting soon, 15 minutes until '.$at->format('g:i A').'. Join your prep video call now.',
        );

        $sent += $this->sendWindowReminders(
            column: 'interview_starting_sent_at',
            from: $now->copy()->subMinute(),
            to: $now->copy()->addMinute(),
            type: 'interview_starting',
            message: fn (Carbon $at) => 'Your interview preparation session is starting now ('.$at->format('g:i A').'). Open Interview to join the video call.',
        );

        $this->info("Sent {$sent} interview reminder(s).");

        return self::SUCCESS;
    }

    /**
     * @param  callable(Carbon): string  $message
     */
    private function sendWindowReminders(
        string $column,
        Carbon $from,
        Carbon $to,
        string $type,
        callable $message,
    ): int {
        $applications = StudentApplication::query()
            ->with('student:id,name,email')
            ->whereNotNull('interview_at')
            ->whereNull($column)
            ->where('interview_status', InterviewStatus::Scheduled)
            ->whereBetween('interview_at', [$from, $to])
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
