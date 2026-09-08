<?php

namespace App\Console\Commands;

use App\Http\Controllers\Api\ChatController;
use App\Models\ChatScheduledMessage;
use Illuminate\Console\Command;

class SendScheduledChatMessages extends Command
{
    protected $signature = 'chat:send-scheduled';

    protected $description = 'Send chat messages that are due based on their scheduled time.';

    public function handle(ChatController $chat): int
    {
        $due = ChatScheduledMessage::query()
            ->where('status', ChatScheduledMessage::STATUS_PENDING)
            ->where('scheduled_at', '<=', now())
            ->orderBy('scheduled_at')
            ->orderBy('id')
            ->limit(100)
            ->get();

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
                $this->error("Scheduled message {$scheduled->id} failed: {$exception->getMessage()}");
            }
        }

        if ($sent > 0 || $failed > 0) {
            $this->info("Scheduled chat messages: sent {$sent}, failed {$failed}.");
        }

        return self::SUCCESS;
    }
}
