<?php

namespace App\Jobs;

use App\Enums\LeadStatus;
use App\Enums\StaffDepartment;
use App\Models\Lead;
use App\Services\LeadClassifierService;
use App\Services\StudentNotificationService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;
use Throwable;

class ClassifyLeadJob implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public int $leadId,
    ) {
    }

    public function handle(
        LeadClassifierService $classifier,
        StudentNotificationService $notifications,
    ): void {
        $lead = Lead::query()->find($this->leadId);
        if (! $lead || $lead->status === LeadStatus::Converted || $lead->status === LeadStatus::Dismissed) {
            return;
        }

        $result = $classifier->classify($lead);

        $lead->forceFill([
            'status' => LeadStatus::Classified,
            'classification' => $result['classification'],
            'classification_score' => $result['score'],
            'classification_reason' => $result['reason'],
            'classification_model' => $result['model'],
            'classified_at' => now(),
        ])->save();

        $label = $result['classification']->label();
        $notifications->notifyDepartment(
            StaffDepartment::Leads,
            null,
            "Lead scored as {$label}: {$lead->name} ({$lead->email}). Score {$result['score']}/100.",
            'lead_classified',
            '/departments/leads',
        );
    }

    public function failed(?Throwable $exception): void
    {
        Log::error('ClassifyLeadJob failed.', [
            'lead_id' => $this->leadId,
            'error' => $exception?->getMessage(),
        ]);
    }
}
