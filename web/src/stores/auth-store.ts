import axios, { AxiosHeaders } from 'axios';
import { create } from 'zustand';

import { api } from '@/lib/api';
import { type Portal, portalFromPath, portalMatchesUser } from '@/lib/portals';
import type { AuthUser } from '@/types/auth';

const LEGACY_TOKEN_KEY = 'ec_web_auth_token';

function sessionKey(portal: Portal): string {
  return `ec_web_session_${portal}`;
}

type StoredSession = {
  token: string;
  user: AuthUser;
};

/**
 * Sessions are stored per portal in localStorage (shared across tabs) and mirrored
 * into sessionStorage for this tab. Different portals never overwrite each other
 * (student / superadmin / staff use different keys).
 */
function readStoredSession(portal: Portal): StoredSession | null {
  const key = sessionKey(portal);

  if (portal === 'superadmin') {
    for (const legacyKey of ['ec_web_session_consultant', 'ec_web_session_superadmin']) {
      try {
        const legacy = localStorage.getItem(legacyKey) ?? sessionStorage.getItem(legacyKey);
        if (legacy) {
          localStorage.setItem(key, legacy);
          sessionStorage.setItem(key, legacy);
          localStorage.removeItem(legacyKey);
          sessionStorage.removeItem(legacyKey);
          break;
        }
      } catch {
        // Ignore migration errors.
      }
    }
  }

  try {
    const fromTab = sessionStorage.getItem(key);
    if (fromTab) {
      const parsed = JSON.parse(fromTab) as StoredSession;
      if (parsed?.token && parsed?.user) return parsed;
    }
  } catch {
    // Ignore corrupt tab session data.
  }

  try {
    const fromShared = localStorage.getItem(key);
    if (fromShared) {
      const parsed = JSON.parse(fromShared) as StoredSession;
      if (parsed?.token && parsed?.user) return parsed;
    }
  } catch {
    localStorage.removeItem(key);
  }

  return null;
}

function writeStoredSession(portal: Portal, session: StoredSession): void {
  const key = sessionKey(portal);
  const payload = JSON.stringify(session);
  sessionStorage.setItem(key, payload);
  localStorage.setItem(key, payload);
}

function removeStoredSession(portal: Portal): void {
  const key = sessionKey(portal);
  sessionStorage.removeItem(key);
  localStorage.removeItem(key);
}

type AuthState = {
  activePortal: Portal | null;
  token: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  /** Load the session for the portal matching the current URL (or a given portal). */
  hydrate: (portal?: Portal | null) => Promise<void>;
  /** Persist a session for one portal without touching the others. */
  setSession: (portal: Portal, token: string, user: AuthUser) => void;
  /** Log out only the active (or given) portal. */
  clearSession: (portal?: Portal | null) => void;
  hasPortalSession: (portal: Portal) => boolean;
  peekPortalSession: (portal: Portal) => StoredSession | null;
};

async function validateToken(token: string): Promise<AuthUser | null | 'unreachable'> {
  try {
    const { data } = await api.get<{ user: AuthUser }>('/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return data.user;
  } catch (error) {
    // Only treat a real unauthorized response as a dead session.
    // Network blips must not wipe a valid stored login on refresh.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    return 'unreachable';
  }
}

let hydrateGeneration = 0;

export const useAuthStore = create<AuthState>((set, get) => ({
  activePortal: null,
  token: null,
  user: null,
  hydrated: false,

  hasPortalSession: (portal) => Boolean(readStoredSession(portal)?.token),

  peekPortalSession: (portal) => readStoredSession(portal),

  hydrate: async (portalArg) => {
    const generation = ++hydrateGeneration;

    try {
      const portal =
        portalArg !== undefined
          ? portalArg
          : typeof window !== 'undefined'
            ? portalFromPath(window.location.pathname)
            : null;

      // One-time migration from the old shared token key.
      const legacy = localStorage.getItem(LEGACY_TOKEN_KEY);
      if (legacy) {
        const legacyUser = await validateToken(legacy);
        if (legacyUser && legacyUser !== 'unreachable') {
          const inferred =
            legacyUser.roles.includes('super_admin') || legacyUser.is_super_admin
              ? 'superadmin'
              : legacyUser.roles.includes('student') || legacyUser.is_student
                ? 'student'
                : legacyUser.roles.includes('admin') ||
                    legacyUser.roles.includes('consultant') ||
                    legacyUser.is_admin
                  ? 'superadmin'
                  : 'staff';
          writeStoredSession(inferred, { token: legacy, user: legacyUser });
        }
        localStorage.removeItem(LEGACY_TOKEN_KEY);
      }

      if (generation !== hydrateGeneration) return;

      if (!portal) {
        // Ambiguous URL (welcome, etc.): clear in-memory auth only, keep stored sessions.
        set({ activePortal: null, token: null, user: null, hydrated: true });
        return;
      }

      const stored = readStoredSession(portal);
      if (!stored) {
        set({ activePortal: portal, token: null, user: null, hydrated: true });
        return;
      }

      const user = await validateToken(stored.token);
      if (generation !== hydrateGeneration) return;

      if (user === 'unreachable') {
        // API temporarily unavailable, keep the saved login so refresh does not sign out.
        set({
          activePortal: portal,
          token: stored.token,
          user: stored.user,
          hydrated: true,
        });
        return;
      }

      if (!user || !portalMatchesUser(portal, user)) {
        removeStoredSession(portal);
        set({ activePortal: portal, token: null, user: null, hydrated: true });
        return;
      }

      writeStoredSession(portal, { token: stored.token, user });
      set({
        activePortal: portal,
        token: stored.token,
        user,
        hydrated: true,
      });
    } catch {
      if (generation !== hydrateGeneration) return;
      set({ activePortal: null, token: null, user: null, hydrated: true });
    }
  },

  setSession: (portal, token, user) => {
    // Cancel in-flight hydrates so a stale /me from the login page cannot wipe this session.
    hydrateGeneration += 1;
    writeStoredSession(portal, { token, user });
    set({ activePortal: portal, token, user, hydrated: true });
  },

  clearSession: (portalArg) => {
    hydrateGeneration += 1;
    const portal = portalArg ?? get().activePortal;
    if (portal) {
      removeStoredSession(portal);
    }
    if (!portal || get().activePortal === portal) {
      set({ activePortal: portal ?? null, token: null, user: null });
    }
  },
}));

api.interceptors.request.use((config) => {
  const headers = AxiosHeaders.from(config.headers ?? {});
  const storeToken = useAuthStore.getState().token;

  // Never strip an Authorization header already set on the request (e.g. hydrate /me).
  if (!headers.get('Authorization') && storeToken) {
    headers.set('Authorization', `Bearer ${storeToken}`);
  }

  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    headers.delete('Content-Type');
  }

  config.headers = headers;
  return config;
});
