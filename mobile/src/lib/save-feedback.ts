import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

import { showSaveFeedback } from '@/stores/save-feedback-store';

export const SKIP_SAVE_FEEDBACK_HEADER = 'X-Skip-Save-Feedback';
export const SAVE_FEEDBACK_HEADER = 'X-Save-Feedback';

const SKIP_PATH_FRAGMENTS = [
  '/login',
  '/register',
  '/logout',
  '/notifications/mark-read',
  '/call/join',
  '/call/leave',
  '/typing',
];

function pathFromConfig(config: InternalAxiosRequestConfig): string {
  const url = config.url ?? '';
  return url.split('?')[0] ?? '';
}

function shouldSkipSaveFeedback(config: InternalAxiosRequestConfig): boolean {
  const headers = config.headers;
  if (headers?.[SKIP_SAVE_FEEDBACK_HEADER] === '1' || headers?.[SKIP_SAVE_FEEDBACK_HEADER] === true) {
    return true;
  }

  const path = pathFromConfig(config);
  if (SKIP_PATH_FRAGMENTS.some((fragment) => path.includes(fragment))) {
    return true;
  }

  if (config.method?.toLowerCase() === 'post' && /\/chat\/conversations\/\d+\/messages/.test(path)) {
    return true;
  }

  return false;
}

function defaultSaveMessage(method: string): string {
  switch (method.toLowerCase()) {
    case 'post':
      return 'Saved successfully.';
    case 'put':
    case 'patch':
      return 'Updated successfully.';
    case 'delete':
      return 'Deleted successfully.';
    default:
      return 'Saved successfully.';
  }
}

function resolveSaveFeedbackMessage(config: InternalAxiosRequestConfig): string | null {
  const custom = config.headers?.[SAVE_FEEDBACK_HEADER];
  if (typeof custom === 'string' && custom.trim().length > 0) {
    return custom.trim();
  }

  const method = config.method?.toLowerCase() ?? 'post';
  if (!['post', 'put', 'patch', 'delete'].includes(method)) {
    return null;
  }

  if (shouldSkipSaveFeedback(config)) {
    return null;
  }

  const path = pathFromConfig(config);

  if (path.includes('cancel-meeting')) return 'Meeting cancelled.';
  if (path.includes('complete-preparation')) return 'Preparation marked complete.';
  if (path.includes('/student/profile') || path.includes('/student/personal-information')) {
    return 'Personal information saved.';
  }
  if (path.includes('/student/documents')) {
    return method === 'delete' ? 'Document deleted.' : 'Document saved.';
  }
  if (path.includes('/consultant/documents')) return 'Document status updated.';
  if (path.includes('charge-receipts')) {
    return method === 'patch' ? 'Charge slip updated.' : 'Charge slip saved.';
  }
  if (path.includes('visa-appointments')) {
    return method === 'put' ? 'Appointment updated.' : 'Appointment scheduled.';
  }
  if (path.includes('/applications/')) return 'Interview updated.';
  if (path.includes('/organization/users') && method === 'delete') return 'User removed.';
  if (path.includes('/organization/users')) return 'Team member saved.';
  if (path.includes('/consultant/students/') && path.includes('/universities')) {
    return method === 'delete' ? 'University removed.' : 'University shared.';
  }
  if (path.includes('/consultant/universities') && method === 'post') return 'University saved.';
  if (path.includes('/chat/conversations/') && path.includes('/block')) {
    return method === 'delete' ? 'User unblocked.' : 'User blocked.';
  }

  return defaultSaveMessage(method);
}

export function registerSaveFeedbackInterceptor(client: AxiosInstance): void {
  client.interceptors.response.use((response: AxiosResponse) => {
    const message = resolveSaveFeedbackMessage(response.config);
    if (message) {
      showSaveFeedback(message);
    }
    return response;
  });
}
