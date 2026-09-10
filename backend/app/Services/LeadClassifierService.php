<?php

namespace App\Services;

use App\Enums\LeadClassification;
use App\Models\Lead;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class LeadClassifierService
{
    /**
     * @return array{classification: LeadClassification, score: int, reason: string, model: string}
     */
    public function classify(Lead $lead): array
    {
        $apiKey = config('services.openai.api_key');
        if (filled($apiKey)) {
            try {
                return $this->classifyWithOpenAi($lead, (string) $apiKey);
            } catch (Throwable $exception) {
                Log::warning('Lead OpenAI classification failed; using heuristic.', [
                    'lead_id' => $lead->id,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        return $this->classifyHeuristic($lead);
    }

    /**
     * @return array{classification: LeadClassification, score: int, reason: string, model: string}
     */
    private function classifyWithOpenAi(Lead $lead, string $apiKey): array
    {
        $model = (string) config('services.openai.model', 'gpt-4o-mini');
        $payload = [
            'name' => $lead->name,
            'email' => $lead->email,
            'phone' => $lead->phone,
            'city' => $lead->city,
            'preferred_country' => $lead->preferred_country,
            'study_level' => $lead->study_level,
            'intended_program' => $lead->intended_program,
            'budget_range' => $lead->budget_range,
            'preferred_intake' => $lead->preferred_intake,
            'intake_year' => $lead->intake_year,
            'qualification' => $lead->qualification,
            'grade' => $lead->grade,
            'english_status' => $lead->english_status,
            'english_score' => $lead->english_score,
            'services' => $lead->services,
            'contact_method' => $lead->contact_method,
            'contact_time' => $lead->contact_time,
        ];

        $response = Http::withToken($apiKey)
            ->timeout(45)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => $model,
                'temperature' => 0.1,
                'response_format' => ['type' => 'json_object'],
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You classify study-abroad lead forms for an education consultancy. '
                            .'Return JSON with keys: classification (interested|future|ignore), score (0-100), reason (short). '
                            .'interested = ready to start soon with clear intent. '
                            .'future = genuine but later/vague timeline. '
                            .'ignore = spam, incomplete, or not a real prospect.',
                    ],
                    [
                        'role' => 'user',
                        'content' => json_encode($payload, JSON_THROW_ON_ERROR),
                    ],
                ],
            ])
            ->throw()
            ->json();

        $content = (string) data_get($response, 'choices.0.message.content', '{}');
        $parsed = json_decode($content, true, 512, JSON_THROW_ON_ERROR);

        $classification = LeadClassification::tryFrom((string) ($parsed['classification'] ?? ''))
            ?? LeadClassification::Future;
        $score = max(0, min(100, (int) ($parsed['score'] ?? 50)));
        $reason = trim((string) ($parsed['reason'] ?? 'Model classification complete.'));

        return [
            'classification' => $classification,
            'score' => $score,
            'reason' => $reason !== '' ? $reason : 'Model classification complete.',
            'model' => $model,
        ];
    }

    /**
     * @return array{classification: LeadClassification, score: int, reason: string, model: string}
     */
    private function classifyHeuristic(Lead $lead): array
    {
        $score = 35;
        $reasons = [];

        $message = strtolower(trim((string) $lead->message));
        $timeline = strtolower(trim(implode(' ', array_filter([
            (string) $lead->timeline,
            (string) $lead->preferred_intake,
            (string) $lead->intake_year,
            (string) $lead->contact_time,
        ]))));
        $program = trim((string) $lead->intended_program);
        $country = trim((string) $lead->preferred_country);
        $phone = trim((string) $lead->phone);
        $budget = trim((string) $lead->budget_range);
        $city = trim((string) $lead->city);
        $services = is_array($lead->services) ? $lead->services : [];
        $grade = trim((string) $lead->grade);

        if (filter_var($lead->email, FILTER_VALIDATE_EMAIL)) {
            $score += 10;
        } else {
            $score -= 30;
            $reasons[] = 'Invalid email';
        }

        if ($phone !== '') {
            $score += 10;
        } else {
            $score -= 10;
            $reasons[] = 'No phone number';
        }

        if ($city !== '') {
            $score += 5;
        }
        if ($program !== '') {
            $score += 10;
        }
        if ($country !== '') {
            $score += 10;
        }
        if ($budget !== '' && ! str_contains(strtolower($budget), 'not sure')) {
            $score += 8;
        }
        if ($grade !== '') {
            $score += 6;
        }
        if ($services !== []) {
            $score += min(12, count($services) * 3);
            if (in_array('Complete Guidance', $services, true)) {
                $score += 6;
                $reasons[] = 'Requested complete guidance';
            }
        }

        if ($message !== '') {
            $score += min(10, (int) floor(strlen($message) / 25));
        }

        $spamHints = ['crypto', 'seo service', 'click here', 'http://', 'https://', 'viagra', 'casino'];
        foreach ($spamHints as $hint) {
            if (str_contains($message, $hint)) {
                $score -= 40;
                $reasons[] = 'Spam-like content';
                break;
            }
        }

        $soonHints = ['asap', 'this month', 'next month', 'immediate', 'urgent', 'ready', 'soon', '2026', 'spring', 'fall'];
        $laterHints = ['next year', '2028', '2029', 'maybe', 'thinking', 'not sure', 'later', 'future'];

        $timelineSoon = false;
        foreach ($soonHints as $hint) {
            if (str_contains($timeline, $hint) || str_contains($message, $hint)) {
                $timelineSoon = true;
                $score += 10;
                break;
            }
        }

        $timelineLater = false;
        foreach ($laterHints as $hint) {
            if (str_contains($timeline, $hint) || str_contains($message, $hint)) {
                $timelineLater = true;
                break;
            }
        }

        $score = max(0, min(100, $score));

        if ($score < 35 || in_array('Spam-like content', $reasons, true)) {
            $classification = LeadClassification::Ignore;
            $reasons[] = 'Low quality or likely not a real prospect';
        } elseif ($timelineLater && ! $timelineSoon) {
            $classification = LeadClassification::Future;
            $reasons[] = 'Timeline looks longer-term';
        } elseif ($score >= 65 && ($timelineSoon || ($program !== '' && $country !== '' && $services !== []))) {
            $classification = LeadClassification::Interested;
            $reasons[] = 'Strong intent signals';
        } else {
            $classification = LeadClassification::Future;
            $reasons[] = 'Genuine lead but not clearly ready now';
        }

        return [
            'classification' => $classification,
            'score' => $score,
            'reason' => implode('. ', array_unique($reasons)).'.',
            'model' => 'heuristic-v1',
        ];
    }
}
