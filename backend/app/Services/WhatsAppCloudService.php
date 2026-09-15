<?php

namespace App\Services;

use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use RuntimeException;

class WhatsAppCloudService
{
    public function isConfigured(): bool
    {
        return filled(config('services.whatsapp.token'))
            && filled(config('services.whatsapp.phone_number_id'));
    }

    /**
     * Business / test WhatsApp number shown on Meta (e.g. +1 555-200-9488).
     */
    public function businessDisplayNumber(): ?string
    {
        if (! $this->isConfigured()) {
            return null;
        }

        $version = (string) config('services.whatsapp.api_version', 'v25.0');
        $phoneNumberId = (string) config('services.whatsapp.phone_number_id');
        $token = (string) config('services.whatsapp.token');

        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(10)
                ->get("https://graph.facebook.com/{$version}/{$phoneNumberId}", [
                    'fields' => 'display_phone_number',
                ]);

            if (! $response->successful()) {
                return null;
            }

            $display = $response->json('display_phone_number');

            return is_string($display) && $display !== '' ? $display : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * Normalize a stored phone into WhatsApp digits (country code, no +).
     */
    public function normalizePhone(?string $phone): ?string
    {
        if ($phone === null || trim($phone) === '') {
            return null;
        }

        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if ($digits === '') {
            return null;
        }

        if (str_starts_with($digits, '00')) {
            $digits = substr($digits, 2);
        }

        $defaultCountry = (string) config('services.whatsapp.default_country_code', '92');

        // Local numbers with a leading trunk 0 (e.g. 0300… → 92300…).
        if (str_starts_with($digits, '0') && strlen($digits) >= 10 && strlen($digits) <= 11) {
            $digits = $defaultCountry.substr($digits, 1);
        }

        // Common Pakistan mobiles stored without 0 or country code (e.g. 3001234567).
        if (
            $defaultCountry === '92'
            && strlen($digits) === 10
            && str_starts_with($digits, '3')
        ) {
            $digits = $defaultCountry.$digits;
        }

        // Same pattern for other default countries: national length 10 without country prefix.
        if (
            $defaultCountry !== '92'
            && strlen($digits) === 10
            && ! str_starts_with($digits, $defaultCountry)
        ) {
            $digits = $defaultCountry.$digits;
        }

        return strlen($digits) >= 10 && strlen($digits) <= 15 ? $digits : null;
    }

    /**
     * @return array{provider_message_id: string|null, mode: 'text'|'template'|'image'|'document'|'video', to: string}
     */
    public function sendMessage(
        string $toPhone,
        string $body,
        ?string $mediaContents = null,
        ?string $mediaMime = null,
        ?string $mediaFilename = null,
    ): array {
        if (! $this->isConfigured()) {
            throw new RuntimeException(
                'WhatsApp is not configured. Add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID to the server environment.',
            );
        }

        $to = $this->normalizePhone($toPhone);
        if ($to === null) {
            throw new RuntimeException('Student phone number is missing or invalid.');
        }

        $trimmed = trim($body);
        $hasMedia = $mediaContents !== null && $mediaContents !== '';

        if ($trimmed === '' && ! $hasMedia) {
            throw new RuntimeException('Enter a message or attach a file for WhatsApp.');
        }

        if ($hasMedia) {
            $result = $this->sendMediaMessage(
                $to,
                $mediaContents,
                (string) $mediaMime,
                $mediaFilename ?: 'attachment',
                $trimmed !== '' ? $trimmed : null,
            );
            $result['to'] = $to;

            return $result;
        }

        // Only force templates when explicitly enabled. Template name alone is for
        // optional outside-window fallback of approved body templates — never hello_world.
        $preferTemplate = filter_var(config('services.whatsapp.prefer_template', false), FILTER_VALIDATE_BOOLEAN);

        if ($preferTemplate) {
            $result = $this->sendTemplateMessage($to, $trimmed);
            $result['to'] = $to;

            return $result;
        }

        try {
            $response = $this->postMessage([
                'messaging_product' => 'whatsapp',
                'recipient_type' => 'individual',
                'to' => $to,
                'type' => 'text',
                'text' => [
                    'preview_url' => false,
                    'body' => $trimmed,
                ],
            ]);

            return [
                'provider_message_id' => data_get($response, 'messages.0.id'),
                'mode' => 'text',
                'to' => $to,
            ];
        } catch (RuntimeException $exception) {
            if ($this->isAuthenticationError($exception)) {
                throw $exception;
            }

            if ($this->shouldFallbackToTemplate($exception)) {
                $result = $this->sendTemplateMessage($to, $trimmed);
                $result['to'] = $to;

                return $result;
            }

            if ($this->isOutsideCustomerCareWindow($exception)) {
                $business = $this->businessDisplayNumber() ?? $this->businessNumberHint();
                throw new RuntimeException(
                    "WhatsApp can only deliver the staff’s exact text for 24 hours after the student messages your business number ({$business}). "
                    .'On the student phone, open WhatsApp → send any message to that business number → then retry WhatsApp from the project. '
                    .'Meta’s dashboard “Hello World” template can arrive without this step; free-form staff text cannot.',
                    previous: $exception,
                );
            }

            throw $exception;
        }
    }

    /**
     * @return array{provider_message_id: string|null, mode: 'image'|'document'|'video'}
     */
    private function sendMediaMessage(
        string $to,
        string $contents,
        string $mime,
        string $filename,
        ?string $caption,
    ): array {
        $waType = $this->whatsAppMediaType($mime, $filename);
        if ($waType === null) {
            throw new RuntimeException(
                'This file type cannot be sent on WhatsApp. Use JPG, PNG, PDF, DOC, DOCX, or MP4.',
            );
        }

        $mediaId = $this->uploadMedia($contents, $mime ?: $this->fallbackMime($waType), $filename);

        $mediaPayload = ['id' => $mediaId];
        if ($caption !== null && $caption !== '') {
            $mediaPayload['caption'] = Str::limit($caption, 1024, '');
        }
        if ($waType === 'document') {
            $mediaPayload['filename'] = $filename;
        }

        $response = $this->postMessage([
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $to,
            'type' => $waType,
            $waType => $mediaPayload,
        ]);

        return [
            'provider_message_id' => data_get($response, 'messages.0.id'),
            'mode' => $waType,
        ];
    }

    private function uploadMedia(string $contents, string $mime, string $filename): string
    {
        $version = (string) config('services.whatsapp.api_version', 'v21.0');
        $phoneNumberId = (string) config('services.whatsapp.phone_number_id');
        $token = (string) config('services.whatsapp.token');

        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(60)
                ->attach('file', $contents, $filename, ['Content-Type' => $mime])
                ->post("https://graph.facebook.com/{$version}/{$phoneNumberId}/media", [
                    'messaging_product' => 'whatsapp',
                    'type' => $mime,
                ])
                ->throw();
        } catch (RequestException $exception) {
            $this->throwFromWhatsAppException($exception, 'WhatsApp media upload error');
        }

        $mediaId = data_get($response->json(), 'id');
        if (! is_string($mediaId) || $mediaId === '') {
            throw new RuntimeException('WhatsApp media upload did not return a media id.');
        }

        return $mediaId;
    }

    private function whatsAppMediaType(string $mime, string $filename): ?string
    {
        $mime = strtolower(trim($mime));
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        if (in_array($mime, ['image/jpeg', 'image/jpg', 'image/png'], true) || in_array($ext, ['jpg', 'jpeg', 'png'], true)) {
            return 'image';
        }

        if (in_array($mime, ['video/mp4', 'video/3gpp'], true) || in_array($ext, ['mp4', '3gp'], true)) {
            return 'video';
        }

        if (
            in_array($mime, [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'text/plain',
            ], true)
            || in_array($ext, ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt'], true)
        ) {
            return 'document';
        }

        // Common chat uploads that WhatsApp won't take as native video — send as document when possible.
        if (in_array($ext, ['mov', 'webm', 'm4v', 'avi'], true)) {
            return null;
        }

        return null;
    }

    private function fallbackMime(string $waType): string
    {
        return match ($waType) {
            'image' => 'image/jpeg',
            'video' => 'video/mp4',
            default => 'application/pdf',
        };
    }

    /**
     * @return array{provider_message_id: string|null, mode: 'template'}
     */
    private function sendTemplateMessage(string $to, string $body): array
    {
        $template = (string) config('services.whatsapp.template_name', '');
        $language = (string) config('services.whatsapp.template_language', 'en_US');

        if ($template === '') {
            throw new RuntimeException(
                'WhatsApp template is not configured. Set WHATSAPP_TEMPLATE_NAME, or ask the student to message your WhatsApp number first so free-form text can be sent.',
            );
        }

        $payload = [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $to,
            'type' => 'template',
            'template' => [
                'name' => $template,
                'language' => ['code' => $language],
            ],
        ];

        if (! in_array($template, ['hello_world'], true)) {
            $payload['template']['components'] = [[
                'type' => 'body',
                'parameters' => [[
                    'type' => 'text',
                    'text' => Str::limit($body, 1024, ''),
                ]],
            ]];
        }

        $response = $this->postMessage($payload);

        return [
            'provider_message_id' => data_get($response, 'messages.0.id'),
            'mode' => 'template',
        ];
    }

    private function shouldFallbackToTemplate(RuntimeException $exception): bool
    {
        if ($this->isAuthenticationError($exception)) {
            return false;
        }

        $template = strtolower(trim((string) config('services.whatsapp.template_name', '')));
        // hello_world cannot carry the staff message — never use it as a silent fallback.
        if ($template === '' || $template === 'hello_world') {
            return false;
        }

        return $this->isOutsideCustomerCareWindow($exception);
    }

    private function businessNumberHint(): string
    {
        $id = trim((string) config('services.whatsapp.phone_number_id', ''));

        return $id !== '' ? 'the number linked to phone ID '.$id : 'your Meta test/business number';
    }

    private function isAuthenticationError(RuntimeException $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, '(#190)')
            || str_contains($message, 'whatsapp login expired')
            || str_contains($message, 'oauthexception')
            || (str_contains($message, 'authentication') && str_contains($message, 'error'));
    }

    private function isOutsideCustomerCareWindow(RuntimeException $exception): bool
    {
        if ($this->isAuthenticationError($exception)) {
            return false;
        }

        $message = strtolower($exception->getMessage());

        return str_contains($message, '131047')
            || str_contains($message, '130472')
            || str_contains($message, 're-engagement')
            || str_contains($message, 'customer care')
            || str_contains($message, 'outside the allowed window')
            || str_contains($message, 'more than 24 hours')
            || str_contains($message, '24-hour');
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, mixed>
     */
    private function postMessage(array $payload): array
    {
        $version = (string) config('services.whatsapp.api_version', 'v21.0');
        $phoneNumberId = (string) config('services.whatsapp.phone_number_id');
        $token = (string) config('services.whatsapp.token');

        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->asJson()
                ->timeout(20)
                ->post("https://graph.facebook.com/{$version}/{$phoneNumberId}/messages", $payload)
                ->throw();
        } catch (RequestException $exception) {
            $this->throwFromWhatsAppException($exception, 'WhatsApp API error');
        }

        /** @var array<string, mixed> $json */
        $json = $response->json() ?? [];

        return $json;
    }

    private function throwFromWhatsAppException(RequestException $exception, string $label): never
    {
        $json = $exception->response?->json();
        $error = data_get($json, 'error.message')
            ?? data_get($json, 'error.error_user_msg')
            ?? $exception->getMessage();
        $code = data_get($json, 'error.code');

        if ((int) $code === 190) {
            throw new RuntimeException(
                'WhatsApp login expired. In Meta Developer → WhatsApp → API Setup, create a new permanent access token (System User), set WHATSAPP_TOKEN on the API server, then redeploy or restart. Temporary tokens expire quickly.',
                previous: $exception,
            );
        }

        $prefix = $code ? "{$label} (#{$code}): " : "{$label}: ";

        throw new RuntimeException($prefix.$error, previous: $exception);
    }
}
