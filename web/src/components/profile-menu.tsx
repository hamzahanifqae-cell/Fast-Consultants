import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  isOrganizationUser,
  organizationRoleLabel,
} from '@/lib/roles';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuthStore } from '@/stores/auth-store';
import './profile-menu.css';

function initialsFromName(name: string | undefined) {
  return (name ?? 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function ProfileMenu() {
  const user = useAuthStore((state) => state.user);
  const activePortal = useAuthStore((state) => state.activePortal);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const isTeam = isOrganizationUser(user);
  const initials = initialsFromName(user?.name);
  const roleLabel = isTeam ? organizationRoleLabel(user) : 'Student';

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  function onLogout() {
    clearSession(activePortal);
    setOpen(false);
    navigate(activePortal ? `/${activePortal}/login` : '/', { replace: true });
  }

  return (
    <div className="profile-menu" ref={rootRef}>
      <button
        type="button"
        className={`profile-menu-trigger${open ? ' open' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Open profile menu"
        onClick={() => setOpen((value) => !value)}>
        <span className="profile-menu-trigger-avatar" aria-hidden>
          {initials || 'U'}
        </span>
      </button>

      {open ? (
        <div className="profile-menu-panel" role="menu">
          <div className="profile-menu-card">
            <div className="profile-menu-avatar" aria-hidden>
              {initials || 'U'}
            </div>
            <div className="profile-menu-copy">
              <strong title={user?.name}>{user?.name}</strong>
              <span>{roleLabel}</span>
            </div>
          </div>

          <div className="profile-menu-divider" />

          <button type="button" className="profile-menu-logout" role="menuitem" onClick={onLogout}>
            Log out
          </button>

          <div className="profile-menu-theme" role="none">
            <ThemeToggle variant="onDark" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
