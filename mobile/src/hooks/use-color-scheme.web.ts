import { useEffect, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemeStore } from '@/stores/theme-store';

/** Resolves light/dark from user preference (including system default). */
export function useColorScheme(): 'light' | 'dark' {
  const [hasHydrated, setHasHydrated] = useState(false);
  const preference = useThemeStore((state) => state.preference);
  const systemScheme = useSystemColorScheme();

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const resolvedSystem = hasHydrated && systemScheme === 'dark' ? 'dark' : 'light';

  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return resolvedSystem;
}
