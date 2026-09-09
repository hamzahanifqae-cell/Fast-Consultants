<?php

namespace App\Services;

use App\Models\ChatScheduledMessage;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ScheduledChatDispatcher
{
    /**
     * Send every pending scheduled chat message that is due.
     *
     * @return array{sent: int, failed: int}
     */
    public function sendDue(): array
    {
        $due = ChatScheduledMessage::query()
            ->where('status', ChatScheduledMessage::STATUS_PENDING)
            ->where('scheduled_at', '<=', now())
            ->orderBy('scheduled_at')
            ->orderBy('id')
            ->limit(100)
            ->get();

        if ($due->isEmpty()) {
            return ['sent' => 0, 'failed' => 0];
        }

        // Resolve lazily to avoid constructor cycles with ChatController.
        $chat = app(\App\Http\Controllers\Api\ChatController::class);

        $sent = 0;
        $failed = 0;

        foreach ($due as $scheduled) {
            try {
                $chat->dispatchScheduledMessage($scheduled);
                $sent++;
            } catch (\Throwable $exception) {
                $scheduled->update([
                    'status' => ChatScheduledMessage::STATUS_FAILED,
                    'error_message' => $exception->getMessage(),
                ]);
                $failed++;
                Log::warning('Scheduled chat message failed.', [
                    'scheduled_id' => $scheduled->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        return ['sent' => $sent, 'failed' => $failed];
    }

    /**
     * Opportunistically flush due messages (e.g. while chat is polled).
     * Avoids depending only on cron / schedule:work during local `artisan serve`.
     */
    public function sendDueIfNeeded(): void
    {
        if (! Cache::add('chat:send-scheduled:tick', true, 20)) {
            return;
        }

        try {
            // Run via Artisan so this never re-enters ChatController resolution mid-request.
            Artisan::call('chat:send-scheduled');
        } catch (\Throwable $exception) {
            Log::warning('Opportunistic scheduled chat flush failed.', [
                'error' => $exception->getMessage(),
            ]);
        }
    }
}
