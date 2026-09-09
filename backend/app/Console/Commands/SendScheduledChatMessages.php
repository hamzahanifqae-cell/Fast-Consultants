<?php

namespace App\Console\Commands;

use App\Services\ScheduledChatDispatcher;
use Illuminate\Console\Command;

class SendScheduledChatMessages extends Command
{
    protected $signature = 'chat:send-scheduled';

    protected $description = 'Send chat messages that are due based on their scheduled time.';

    public function handle(ScheduledChatDispatcher $dispatcher): int
    {
        $result = $dispatcher->sendDue();

        if ($result['sent'] > 0 || $result['failed'] > 0) {
            $this->info("Scheduled chat messages: sent {$result['sent']}, failed {$result['failed']}.");
        }

        return self::SUCCESS;
    }
}
