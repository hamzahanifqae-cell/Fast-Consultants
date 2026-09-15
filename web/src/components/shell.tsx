import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import type { ChatConversation, UserNotification } from '@/types/auth';
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
  section?: string;
};

type NotificationsPayload = {
  data: UserNotification[];
  unread_count: number;
  unread_by_section?: Record<string, number>;
};

function navClassName({ isActive }: { isActive: boolean }) {
  return `shell-nav-link${isActive ? ' active' : ''}`;
}

function sectionFromPath(pathname: string): string | null {
  if (pathname.includes('/departments/leads') || pathname.endsWith('/leads')) return 'leads';
  if (pathname.includes('/departments/documents') || pathname.includes('/student/documents')) {
    return 'documents';
  }
  if (
    pathname.includes('/form-templates') ||
    pathname.includes('/student/form-templates')
  ) {
    return 'form_templates';
  }
  if (pathname.includes('/departments/universities') || pathname.includes('/student/universities')) {
    return 'universities';
  }
  if (pathname.includes('/departments/finance') || pathname.includes('/charge-receipts')) {
    return 'finance';
  }
  if (
    pathname.includes('/departments/interview') ||
    pathname.includes('/student/interview') ||
    pathname.includes('/student/preparation')
  ) {
    return 'interview';
  }
  if (pathname.includes('/departments/visa') || pathname.includes('/visa-appointments')) {
    return 'visa';
  }
  if (pathname.includes('/student-info') || pathname.includes('/departments/student-info')) {
    return 'student_info';
  }
  if (pathname.includes('/student/status')) return 'status';
  if (pathname.includes('/student/profile')) return 'profile';
  return null;
}

function sectionCount(
  sections: Record<string, number> | undefined,
  key: string | undefined,
): number {
  if (!key || !sections) return 0;
  return sections[key] ?? 0;
}

export function AppShell({ title, subtitle, children, badge: _badge, backTo, backLabel }: AppShellProps) {
  const location = useLocation();
  const queryClient = useQueryClient();
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

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    enabled: Boolean(token),
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await api.get<NotificationsPayload>('/notifications', {
        params: { limit: 50 },
      });
      return data;
    },
  });

  const markSectionRead = useMutation({
    mutationFn: async (section: string) => {
      const { data } = await api.patch<NotificationsPayload>('/notifications/mark-read', {
        section,
      });
      return data;
    },
    onSuccess: (payload) => {
      queryClient.setQueryData(['notifications'], (current: NotificationsPayload | undefined) => ({
        data: current?.data ?? [],
        unread_count: payload.unread_count,
        unread_by_section: payload.unread_by_section,
      }));
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const showStudents =
    hasPermission(user, 'student_info.view') || hasPermission(user, 'student_info.manage');
  const showFinance =
    hasPermission(user, 'finance.view') || hasPermission(user, 'finance.manage');
  const showUniversities =
    hasPermission(user, 'universities.view') || hasPermission(user, 'universities.manage');
  const showVisa = hasPermission(user, 'visa.view') || hasPermission(user, 'visa.manage');
  const showInterview =
    hasPermission(user, 'interview.view') || hasPermission(user, 'interview.manage');
  const showLeads =
    isSuperAdminUser(user) ||
    hasPermission(user, 'leads.view') ||
    hasPermission(user, 'leads.manage') ||
    user?.staff_department === 'leads';
  const showTeam =
    isSuperAdminUser(user) ||
    hasPermission(user, 'users.view') ||
    hasPermission(user, 'users.manage');

  const suggestionsQuery = useQuery({
    queryKey: ['consultant-university-suggestions', 'pending'],
    enabled: Boolean(token) && isTeam && showUniversities,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await api.get<{ data: unknown[] }>('/consultant/university-suggestions', {
        params: { status: 'pending' },
      });
      return data.data;
    },
  });

  const messagesUnread = unreadQuery.data?.unread_count ?? 0;
  const suggestionsPending = suggestionsQuery.data?.length ?? 0;
  const sections = notificationsQuery.data?.unread_by_section;

  const homePath = isTeam ? routes.home : StudentRoutes.home;

  const activeSection = sectionFromPath(location.pathname);
  const activeSectionUnread = sectionCount(sections, activeSection ?? undefined);

  useEffect(() => {
    if (!token || !activeSection || activeSectionUnread <= 0) {
      return;
    }
    markSectionRead.mutate(activeSection);
    // Intentionally depend on section + unread only so opening a page clears its badge.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, activeSectionUnread, token]);

  const teamLinks: NavItem[] = useMemo(
    () => [
      { to: routes.home, label: 'Dashboard' },
      ...(showLeads
        ? [{ to: routes.leads.root, label: 'Leads', section: 'leads', unread: sectionCount(sections, 'leads') }]
        : []),
      ...(showStudents
        ? [
            {
              to: routes.studentInfo.root,
              label: 'Student Info',
              section: 'student_info',
              unread: sectionCount(sections, 'student_info'),
            },
          ]
        : []),
      ...(showStudents
        ? [
            {
              to: routes.documents.root,
              label: 'Documents',
              section: 'documents',
              unread: sectionCount(sections, 'documents'),
            },
          ]
        : []),
      ...(showStudents
        ? [
            {
              to: routes.formTemplates.root,
              label: 'Form templates',
              section: 'form_templates',
              unread: sectionCount(sections, 'form_templates'),
            },
          ]
        : []),
      ...(showUniversities
        ? [
            {
              to: routes.universities.share,
              label: 'Universities',
              section: 'universities',
              unread: sectionCount(sections, 'universities'),
            },
            { to: routes.universities.catalog, label: 'Catalog' },
            {
              to: routes.universities.suggestions,
              label: 'Suggested universities',
              unread: suggestionsPending,
            },
          ]
        : []),
      ...(showFinance
        ? [
            {
              to: routes.finance.root,
              label: 'Finance',
              section: 'finance',
              unread: sectionCount(sections, 'finance'),
            },
          ]
        : []),
      ...(showInterview
        ? [
            {
              to: routes.interview.root,
              label: 'Interview',
              section: 'interview',
              unread: sectionCount(sections, 'interview'),
            },
          ]
        : []),
      ...(showVisa
        ? [
            {
              to: routes.visa.root,
              label: 'File Making',
              section: 'visa',
              unread: sectionCount(sections, 'visa'),
            },
          ]
        : []),
      { to: routes.messages.root, label: 'Messages', unread: messagesUnread },
      ...(showTeam ? [{ to: routes.team.root, label: 'Team & access' }] : []),
    ],
    [
      routes,
      showLeads,
      showStudents,
      showUniversities,
      showFinance,
      showInterview,
      showVisa,
      showTeam,
      sections,
      suggestionsPending,
      messagesUnread,
    ],
  );

  const studentLinks: NavItem[] = useMemo(
    () => [
      { to: StudentRoutes.home, label: 'Dashboard' },
      {
        to: StudentRoutes.profile,
        label: 'Personal info',
        section: 'profile',
        unread: sectionCount(sections, 'profile'),
      },
      {
        to: StudentRoutes.documents,
        label: 'Documents',
        section: 'documents',
        unread: sectionCount(sections, 'documents'),
      },
      {
        to: StudentRoutes.formTemplates,
        label: 'Form templates',
        section: 'form_templates',
        unread: sectionCount(sections, 'form_templates'),
      },
      {
        to: StudentRoutes.universities,
        label: 'Universities',
        section: 'universities',
        unread: sectionCount(sections, 'universities'),
      },
      {
        to: StudentRoutes.chargeReceipts,
        label: 'Charge receipts',
        section: 'finance',
        unread: sectionCount(sections, 'finance'),
      },
      {
        to: StudentRoutes.interview,
        label: 'Interview',
        section: 'interview',
        unread: sectionCount(sections, 'interview'),
      },
      {
        to: StudentRoutes.visaAppointments,
        label: 'File Making appointments',
        section: 'visa',
        unread: sectionCount(sections, 'visa'),
      },
      {
        to: StudentRoutes.status,
        label: 'My status',
        section: 'status',
        unread: sectionCount(sections, 'status'),
      },
      { to: StudentRoutes.messages, label: 'Messages', unread: messagesUnread },
    ],
    [sections, messagesUnread],
  );

  const links = isTeam ? teamLinks : studentLinks;

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
                    {(item.unread ?? 0) > 0 ? (
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
