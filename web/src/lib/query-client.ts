import { QueryClient } from '@tanstack/react-query';

/** Shared React Query defaults, web + mobile stay aligned via the same API. */
export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 5_000,
        refetchOnMount: true,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
        refetchInterval: 12_000,
        refetchIntervalInBackground: false,
      },
    },
  });
}
