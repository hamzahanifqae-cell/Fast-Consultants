import axios, { AxiosHeaders, type AxiosError, type InternalAxiosRequestConfig } from 'axios';

import { registerSaveFeedbackInterceptor } from '@/lib/save-feedback';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api';

type RetriableConfig = InternalAxiosRequestConfig & { __retryCount?: number };

function isLocalApiUrl(url: string): boolean {
  return /localhost|127\.0\.0\.1/i.test(url);
}

export function getApiOrigin(): string {
  return API_URL.replace(/\/api\/?$/, '');
}

/** Fire-and-forget wake-up for free-tier hosts that sleep when idle. */
export function warmApiServer(): void {
  if (isLocalApiUrl(API_URL)) return;
  const origin = getApiOrigin();
  void fetch(`${origin}/up`).catch(() => undefined);
  void fetch(`${origin}/health`).catch(() => undefined);
}

function isRetriableNetworkError(error: AxiosError): boolean {
  if (error.response) return false;
  return (
    error.code === 'ECONNABORTED' ||
    error.code === 'ERR_NETWORK' ||
    error.message.toLowerCase().includes('network')
  );
}

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: 'application/json',
  },
  timeout: 60000,
});

registerSaveFeedbackInterceptor(api);

api.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers ?? {});
  const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;

  if (isFormData) {
    // Browser must set multipart + boundary itself; any preset Content-Type breaks file fields.
    headers.delete('Content-Type');
  } else if (
    config.data != null &&
    typeof config.data === 'object' &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  config.headers = headers;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    if (!config || !isRetriableNetworkError(error)) {
      throw error;
    }

    const retryCount = config.__retryCount ?? 0;
    if (retryCount >= 2) {
      throw error;
    }

    config.__retryCount = retryCount + 1;
    warmApiServer();
    await new Promise((resolve) => setTimeout(resolve, 1200 * config.__retryCount));
    return api.request(config);
  },
);

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  }

  if (!error.response) {
    if (isLocalApiUrl(API_URL)) {
      if (error.code === 'ECONNABORTED') {
        return 'Request timed out. Check that the backend is running.';
      }
      return `Cannot reach the server (${API_URL}). Start the backend with "php artisan serve --host=0.0.0.0 --port=8000".`;
    }

    if (error.code === 'ECONNABORTED') {
      return 'The server is waking up or the network is slow. Please wait a moment and try again.';
    }
    return 'Cannot reach the server right now. It may be waking up after idle time — wait a few seconds and try again.';
  }

  const data = error.response.data as
    | { message?: string; errors?: Record<string, string[]> }
    | undefined;

  const firstFieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;

  return firstFieldError ?? data?.message ?? fallback;
}
