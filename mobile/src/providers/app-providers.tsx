import { QueryClientProvider } from '@tanstack/react-query';
import { type PropsWithChildren, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { api, warmApiServer } from '@/lib/api';
import { createAppQueryClient } from '@/lib/query-client';
import { registerMutationSync, setupMobileFocusSync } from '@/lib/query-sync';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => {
    const client = createAppQueryClient();
    registerMutationSync(api, client);
    return client;
  });

  useEffect(() => {
    warmApiServer();
    return setupMobileFocusSync();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SafeAreaProvider>
  );
}
