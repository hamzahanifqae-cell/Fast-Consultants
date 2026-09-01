import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, useLocation } from 'react-router-dom';

import { PageBackButton } from '@/components/page-back-button';

import { NotificationBell } from '@/components/notification-bell';
import { ProfileMenu } from '@/components/profile-menu';
import { api } from '@/lib/api';
import { departmentRoutes, StudentRoutes } from '@/lib/department-routes';
import { orgPortalForUser, portalForUser } from '@/lib/portals';
import {
  hasPermission,
  isOrganizationUser,
  isSuperAdminUser,
} from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { ChatConversation } from '@/types/auth';
import './shell.css';

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  badge?: string;
  backTo?: string;
  backLabel?: string;
};

type NavItem = {
  to: string;
  label: string;
  unread?: number;
};

function navClassName({ isActive }: { isActive: boolean }) {
  return `shell-nav-link${isActive ? ' active' : ''}`;
}

export function AppShell({ title, subtitle, children, badge, backTo, backLabel }: AppShellProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isTeam = isOrganizationUser(user);
  const portal = portalForUser(user);
  const orgPortal = orgPortalForUser(user);
  const routes = departmentRoutes(orgPortal);

  const unreadQuery = useQuery({
    queryKey: ['chat-conversations'],
    enabled: Boolean(token),
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await api.get<{ data: ChatConversation[]; unread_count: number }>(
        '/chat/conversations',
      );
      return data;
    },
  });

  const messagesUnread = unreadQuery.data?.unread_count ?? 0;

  const showStudents =
    hasPermission(user, 'student_info.view') || hasPermission(user, 'student_info.manage');
  const showFinance =
    hasPermission(user, 'finance.view') || hasPermission(user, 'finance.manage');
  const showUniversities =
    hasPermission(user, 'universities.view') || hasPermission(user, 'universities.manage');
  const showVisa = hasPermission(user, 'visa.view') || hasPermission(user, 'visa.manage');
  const showInterview =
    hasPermission(user, 'interview.view') || hasPermission(user, 'interview.manage');
  const showTeam =
    isSuperAdminUser(user) ||
    hasPermission(user, 'users.view') ||
    hasPermission(user, 'users.manage');

  const messagesPath = isTeam ? routes.messages.root : StudentRoutes.messages;

  const teamLinks: NavItem[] = [
    { to: routes.home, label: 'Dashboard' },
    ...(showStudents ? [{ to: routes.studentInfo.root, label: 'Student Info' }] : []),
    ...(showStudents ? [{ to: routes.documents.root, label: 'Documents' }] : []),
    ...(showUniversities ? [{ to: routes.universities.root, label: 'Universities' }] : []),
    ...(showFinance ? [{ to: routes.finance.root, label: 'Finance' }] : []),
    ...(showInterview ? [{ to: routes.interview.root, label: 'Interview' }] : []),
    ...(showVisa ? [{ to: routes.visa.root, label: 'Visa' }] : []),
    { to: routes.messages.root, label: 'Messages', unread: messagesUnread },
    ...(showTeam ? [{ to: routes.team.root, label: 'Team & access' }] : []),
  ];

  const studentLinks: NavItem[] = [
    { to: StudentRoutes.home, label: 'Dashboard' },
    { to: StudentRoutes.profile, label: 'Personal info' },
    { to: StudentRoutes.documents, label: 'Documents' },
    { to: StudentRoutes.universities, label: 'Universities' },
    { to: StudentRoutes.chargeReceipts, label: 'Charge receipts' },
    { to: StudentRoutes.interview, label: 'Interview' },
    { to: StudentRoutes.visaAppointments, label: 'Visa appointments' },
    { to: StudentRoutes.status, label: 'My status' },
    { to: StudentRoutes.messages, label: 'Messages', unread: messagesUnread },
  ];

  const links = isTeam ? teamLinks : studentLinks;
  const homePath = isTeam ? routes.home : StudentRoutes.home;

  return (
    <div className="shell">
      <aside className="shell-sidebar">
        <div className="shell-sidebar-top">
          <Link to={homePath} className="shell-brand">
            <img
              className="shell-brand-mark"
              src="/favicon.png"
              alt=""
              width={42}
              height={42}
            />
            <span className="shell-brand-copy">
              <span className="shell-brand-name">Fast Consultants</span>
              <span className="shell-brand-tag">
                {portal === 'superadmin'
                  ? 'Super Admin portal'
                  : portal === 'staff'
                    ? 'Staff portal'
                    : 'Student portal'}
              </span>
            </span>
          </Link>

          <div className="shell-nav-block">
            <p className="shell-nav-label">{isTeam ? 'Workspace' : 'Student'}</p>
            <nav className="shell-nav" aria-label="Primary">
              {links.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => {
                    const nestedActive =
                      item.to !== homePath && location.pathname.startsWith(`${item.to}/`);
                    return navClassName({ isActive: isActive || nestedActive });
                  }}
                  end={item.to === homePath}>
                  <span className="shell-nav-indicator" aria-hidden />
                  <span className="shell-nav-label-row">
                    <span>{item.label}</span>
                    {item.to === messagesPath && (item.unread ?? 0) > 0 ? (
                      <span className="shell-nav-badge">
                        {item.unread! > 99 ? '99+' : item.unread}
                      </span>
                    ) : null}
                  </span>
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      </aside>

      <main className="shell-main">
        <header className="shell-header">
          <div className="shell-header-copy">
            {backTo ? (
              <PageBackButton to={backTo} label={backLabel ?? 'Back'} className="shell-header-back" />
            ) : null}
            {badge && badge.toLowerCase() !== title.toLowerCase() ? (
              <span className="shell-badge">{badge}</span>
            ) : null}
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="shell-header-actions">
            <NotificationBell />
            <ProfileMenu />
          </div>
        </header>
        <div className="shell-content">{children}</div>
      </main>
    </div>
  );
}
