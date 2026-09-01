import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { portalFromPath, portalMatchesUser, type Portal } from '@/lib/portals';
import { useAuthStore } from '@/stores/auth-store';

function sessionAlreadySynced(portal: Portal): boolean {
  const { activePortal, token, user } = useAuthStore.getState();
  return (
    activePortal === portal &&
    Boolean(token) &&
    Boolean(user) &&
    portalMatchesUser(portal, user)
  );
}

/**
 * Keep the in-memory auth token aligned with the URL portal whenever the path changes.
 * Prevents a student token from staying active after navigating to /staff/... .
 */
export function PortalAuthSync() {
  const location = useLocation();
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    const portal = portalFromPath(location.pathname);
    if (portal && sessionAlreadySynced(portal)) {
      return;
    }
    void hydrate(portal);
  }, [hydrate, location.pathname]);

  return null;
}
