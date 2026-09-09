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
        if (str_starts_with($digits, '0') && strlen($digits) >= 10 && strlen($digits) <= 11) {
            $digits = $defaultCountry.substr($digits, 1);
        }

        return strlen($digits) >= 8 ? $digits : null;
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

        $preferTemplate = filled(config('services.whatsapp.template_name'))
            || filter_var(config('services.whatsapp.prefer_template', false), FILTER_VALIDATE_BOOLEAN);

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
            if ($this->shouldFallbackToTemplate($exception) && filled(config('services.whatsapp.template_name'))) {
                $result = $this->sendTemplateMessage($to, $trimmed);
                $result['to'] = $to;

                return $result;
            }

            if ($this->isOutsideCustomerCareWindow($exception)) {
                throw new RuntimeException(
                    'WhatsApp text messages only work for 24 hours after the student messages your WhatsApp Business/test number. '
                    .'Ask them to send any message to that number first, or set WHATSAPP_TEMPLATE_NAME for template sends. '
                    .'Original error: '.$exception->getMessage(),
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
            $json = $exception->response?->json();
            $error = data_get($json, 'error.message')
                ?? data_get($json, 'error.error_user_msg')
                ?? $exception->getMessage();
            $code = data_get($json, 'error.code');
            $prefix = $code ? "WhatsApp media upload error (#{$code}): " : 'WhatsApp media upload error: ';

            throw new RuntimeException($prefix.$error, previous: $exception);
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
        return $this->isOutsideCustomerCareWindow($exception)
            || str_contains(strtolower($exception->getMessage()), 'template');
    }

    private function isOutsideCustomerCareWindow(RuntimeException $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, '24')
            || str_contains($message, 're-engagement')
            || str_contains($message, '131047')
            || str_contains($message, '130472')
            || str_contains($message, 'customer care')
            || str_contains($message, 'session');
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
            $json = $exception->response?->json();
            $error = data_get($json, 'error.message')
                ?? data_get($json, 'error.error_user_msg')
                ?? $exception->getMessage();
            $code = data_get($json, 'error.code');

            $prefix = $code ? "WhatsApp API error (#{$code}): " : 'WhatsApp API error: ';

            throw new RuntimeException($prefix.$error, previous: $exception);
        }

        /** @var array<string, mixed> $json */
        $json = $response->json() ?? [];

        return $json;
    }
}
