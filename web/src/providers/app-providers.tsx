import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { AppLoader } from '@/components/app-loader';
import { api } from '@/lib/api';
import { createAppQueryClient } from '@/lib/query-client';
import { registerMutationSync } from '@/lib/query-sync';
import { portalFromPath } from '@/lib/portals';
import { useAuthStore } from '@/stores/auth-store';
import { useThemeStore } from '@/stores/theme-store';

export function AppProviders({ children }: { children: ReactNode }) {
  const hydrate = useAuthStore((state) => state.hydrate);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrateTheme = useThemeStore((state) => state.hydrateTheme);
  const [queryClient] = useState(() => {
    const client = createAppQueryClient();
    registerMutationSync(api, client);
    return client;
  });

  useEffect(() => {
    hydrateTheme();
    const portal = portalFromPath(window.location.pathname);
    void hydrate(portal);
  }, [hydrate, hydrateTheme]);

  if (!hydrated) {
    return <AppLoader message="Starting Fast Consultants…" />;
  }

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
