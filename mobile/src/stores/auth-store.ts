import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import { api } from '@/lib/api';
import type { AuthUser } from '@/types/auth';

const TOKEN_KEY = 'auth_token';

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (token: string, user: AuthUser) => Promise<void>;
  patchUser: (user: Partial<AuthUser>) => void;
  clearSession: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  hydrated: false,
  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);

      if (!token) {
        set({ token: null, user: null, hydrated: true });
        return;
      }

      try {
        const { data } = await api.get<{ user: AuthUser }>('/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        set({ token, user: data.user, hydrated: true });
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        set({ token: null, user: null, hydrated: true });
      }
    } catch {
      set({ token: null, user: null, hydrated: true });
    }
  },
  setSession: async (token, user) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token, user });
  },
  patchUser: (user) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...user } : state.user,
    }));
  },
  clearSession: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null, user: null });
  },
}));

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
