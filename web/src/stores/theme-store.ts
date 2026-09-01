import { create } from 'zustand';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'ec_web_theme';

type ThemeState = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  hydrateTheme: () => void;
  setPreference: (preference: ThemePreference) => void;
};

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function parsePreference(value: string | null): ThemePreference {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return 'system';
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return getSystemTheme();
}

export function applyWebTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

let systemListener: ((event: MediaQueryListEvent) => void) | null = null;

function syncSystemListener(
  preference: ThemePreference,
  apply: (resolved: ResolvedTheme) => void,
) {
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  if (systemListener) {
    media.removeEventListener('change', systemListener);
    systemListener = null;
  }

  if (preference !== 'system') {
    return;
  }

  systemListener = () => {
    const resolved = getSystemTheme();
    applyWebTheme(resolved);
    apply(resolved);
  };
  media.addEventListener('change', systemListener);
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  resolvedTheme: 'light',

  hydrateTheme: () => {
    const preference = parsePreference(localStorage.getItem(THEME_KEY));
    const resolvedTheme = resolveTheme(preference);
    applyWebTheme(resolvedTheme);
    syncSystemListener(preference, (resolved) => set({ resolvedTheme: resolved }));
    set({ preference, resolvedTheme });
  },

  setPreference: (preference) => {
    localStorage.setItem(THEME_KEY, preference);
    const resolvedTheme = resolveTheme(preference);
    applyWebTheme(resolvedTheme);
    syncSystemListener(preference, (resolved) => set({ resolvedTheme: resolved }));
    set({ preference, resolvedTheme });
  },
}));
