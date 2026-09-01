import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { QueryClient } from '@tanstack/react-query';
import { AppState, type AppStateStatus, Platform } from 'react-native';
import { focusManager } from '@tanstack/react-query';

const READ_ONLY_SKIP = [
  '/login',
  '/register',
  '/logout',
  '/me',
  '/notifications/mark-read',
  '/call/join',
  '/call/leave',
  '/typing',
];

type InvalidationRule = {
  test: RegExp;
  keys: string[][];
};

const MUTATION_INVALIDATIONS: InvalidationRule[] = [
  {
    test: /\/student\/profile|personal-information/,
    keys: [
      ['student-profile'],
      ['student-application-status'],
      ['consultant-students-progress'],
      ['consultant-students'],
    ],
  },
  {
    test: /\/student\/documents|\/consultant\/documents/,
    keys: [
      ['student-documents'],
      ['consultant-documents'],
      ['consultant-documents-overview'],
      ['student-application-status'],
      ['consultant-students-progress'],
    ],
  },
  {
    test: /charge-receipts/,
    keys: [
      ['student-charge-receipts'],
      ['consultant-charge-receipts'],
      ['consultant-charge-receipts-overview'],
      ['student-application-status'],
      ['consultant-students-progress'],
    ],
  },
  {
    test: /visa-appointments/,
    keys: [
      ['student-visa-appointments'],
      ['consultant-visa-appointments'],
      ['student-application-status'],
      ['consultant-students-progress'],
    ],
  },
  {
    test: /\/applications\/|complete-preparation|cancel-meeting|followup-preference/,
    keys: [
      ['student-application-status'],
      ['consultant-applications'],
      ['consultant-application'],
      ['consultant-students-progress'],
      ['student-interview-video-room'],
      ['consultant-interview-video-room'],
    ],
  },
  {
    test: /\/consultant\/universities|\/student\/universities|student_university/,
    keys: [
      ['consultant-universities'],
      ['student-universities'],
      ['student-assigned-universities'],
      ['consultant-students-progress'],
    ],
  },
  {
    test: /\/organization\/users/,
    keys: [['organization-users']],
  },
  {
    test: /\/chat\/conversations/,
    keys: [['chat-conversations'], ['notifications']],
  },
  {
    test: /\/register/,
    keys: [
      ['consultant-students'],
      ['consultant-students-progress'],
      ['organization-users'],
    ],
  },
];

function pathFromConfig(config: InternalAxiosRequestConfig): string {
  const url = config.url ?? '';
  return url.split('?')[0] ?? '';
}

function shouldSkipSync(config: InternalAxiosRequestConfig): boolean {
  const method = config.method?.toLowerCase() ?? 'get';
  if (!['post', 'put', 'patch', 'delete'].includes(method)) {
    return true;
  }

  const path = pathFromConfig(config);
  return READ_ONLY_SKIP.some((fragment) => path.includes(fragment));
}

function invalidateForPath(queryClient: QueryClient, path: string) {
  const seen = new Set<string>();

  for (const rule of MUTATION_INVALIDATIONS) {
    if (!rule.test.test(path)) continue;
    for (const key of rule.keys) {
      const id = key.join('\0');
      if (seen.has(id)) continue;
      seen.add(id);
      void queryClient.invalidateQueries({ queryKey: key });
    }
  }
}

/** After any write, refresh related cached lists so web/mobile show the same data. */
export function registerMutationSync(client: AxiosInstance, queryClient: QueryClient) {
  client.interceptors.response.use((response) => {
    if (!shouldSkipSync(response.config)) {
      invalidateForPath(queryClient, pathFromConfig(response.config));
    }
    return response;
  });
}

/** Refetch active queries when the app returns to the foreground. */
export function setupMobileFocusSync() {
  if (Platform.OS === 'web') return () => {};

  function onAppStateChange(status: AppStateStatus) {
    focusManager.setFocused(status === 'active');
  }

  const subscription = AppState.addEventListener('change', onAppStateChange);
  return () => subscription.remove();
}
