import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { AppLoader } from '@/components/app-loader';
import {
  homeForPortal,
  loginForPortal,
  type Portal,
  portalMatchesUser,
} from '@/lib/portals';
import { useAuthStore } from '@/stores/auth-store';

function hasActivePortalSession(portal: Portal): boolean {
  const { activePortal, token, user } = useAuthStore.getState();
  return (
    activePortal === portal &&
    Boolean(token) &&
    Boolean(user) &&
    portalMatchesUser(portal, user)
  );
}

/** Welcome / shared guest pages, never force-redirect based on another portal's session. */
export function GuestOnly() {
  const hydrate = useAuthStore((state) => state.hydrate);
  const location = useLocation();

  useEffect(() => {
    // Clear in-memory token on shared pages so a student session cannot leak into staff flows.
    void hydrate(null);
  }, [hydrate, location.pathname]);

  return <Outlet />;
}

type PortalGuestProps = {
  portal: Portal;
};

/** Login/register for one portal: redirect home only if THAT portal is already signed in. */
export function PortalGuestOnly({ portal }: PortalGuestProps) {
  const location = useLocation();
  const hydrate = useAuthStore((state) => state.hydrate);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const activePortal = useAuthStore((state) => state.activePortal);
  const peekPortalSession = useAuthStore((state) => state.peekPortalSession);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (hasActivePortalSession(portal)) {
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    setReady(false);
    void hydrate(portal).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrate, portal, location.pathname]);

  if (!ready) {
    return <AppLoader message="Preparing your page…" />;
  }

  const session = peekPortalSession(portal);
  const signedIn =
    (activePortal === portal && token && user && portalMatchesUser(portal, user)) ||
    (session?.user ? portalMatchesUser(portal, session.user) : false);

  if (signedIn) {
    return <Navigate to={homeForPortal(portal)} replace />;
  }

  return <Outlet />;
}

type PortalGuardProps = {
  portal: Portal;
};

/** Authenticated routes that only the matching portal role may open. */
export function RequirePortal({ portal }: PortalGuardProps) {
  const location = useLocation();
  const hydrate = useAuthStore((state) => state.hydrate);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const activePortal = useAuthStore((state) => state.activePortal);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (hasActivePortalSession(portal)) {
      setReady(true);
      return () => {
        cancelled = true;
      };
    }

    setReady(false);
    void hydrate(portal).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrate, portal, location.pathname]);

  if (!ready) {
    return <AppLoader message="Preparing your page…" />;
  }

  if (activePortal !== portal || !token || !user) {
    return <Navigate to={loginForPortal(portal)} replace state={{ from: location.pathname }} />;
  }

  if (!portalMatchesUser(portal, user)) {
    return <Navigate to={loginForPortal(portal)} replace />;
  }

  return <Outlet />;
}
