import { useColorScheme as useSystemColorScheme } from 'react-native';

import { useThemeStore } from '@/stores/theme-store';

/** Resolves light/dark from user preference (including system default). */
export function useColorScheme(): 'light' | 'dark' {
  const preference = useThemeStore((state) => state.preference);
  const systemScheme = useSystemColorScheme();

  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
}
