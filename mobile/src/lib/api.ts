import axios from 'axios';

import { registerSaveFeedbackInterceptor } from '@/lib/save-feedback';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

registerSaveFeedbackInterceptor(api);

export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (!axios.isAxiosError(error)) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return fallback;
  }

  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Check your Wi‑Fi and that the backend is running.';
    }
    return `Cannot reach the server (${API_URL}). Start the backend with "php artisan serve --host=0.0.0.0 --port=8000" and confirm your phone is on the same Wi‑Fi.`;
  }

  const data = error.response.data as
    | { message?: string; errors?: Record<string, string[]> }
    | undefined;

  const firstFieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : undefined;

  return firstFieldError ?? data?.message ?? fallback;
}
