import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_KEY = 'ec_app_theme_preference';

type ThemeState = {
  preference: ThemePreference;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

function parsePreference(value: string | null): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  hydrated: false,

  hydrate: async () => {
    try {
      const stored = await SecureStore.getItemAsync(THEME_KEY);
      set({ preference: parsePreference(stored), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },

  setPreference: async (preference) => {
    await SecureStore.setItemAsync(THEME_KEY, preference);
    set({ preference });
  },
}));
