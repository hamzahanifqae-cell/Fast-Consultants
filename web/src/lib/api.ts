import axios, { AxiosHeaders } from 'axios';

import { registerSaveFeedbackInterceptor } from '@/lib/save-feedback';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000/api';

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

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  }

  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Check that the backend is running.';
    }
    return `Cannot reach the server (${API_URL}). Start the backend with "php artisan serve --host=0.0.0.0 --port=8000".`;
  }

  const data = error.response.data as
    | { message?: string; errors?: Record<string, string[]> }
    | undefined;

  const firstFieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;

  return firstFieldError ?? data?.message ?? fallback;
}
