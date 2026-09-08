import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';

import { api } from '@/lib/api';
import { departmentRoutes, StudentRoutes } from '@/lib/department-routes';
import { orgPortalForUser } from '@/lib/portals';
import { isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { ChatConversation } from '@/types/auth';

import './chat-fab.css';

export function ChatFab() {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const isTeam = isOrganizationUser(user);
  const orgPortal = orgPortalForUser(user);
  const routes = departmentRoutes(orgPortal);
  const messagesPath = isTeam ? routes.messages.root : StudentRoutes.messages;

  const unreadQuery = useQuery({
    queryKey: ['chat-conversations'],
    enabled: Boolean(token) && Boolean(user),
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await api.get<{ data: ChatConversation[]; unread_count: number }>(
        '/chat/conversations',
      );
      return data;
    },
  });

  if (!token || !user) {
    return null;
  }

  if (location.pathname === messagesPath || location.pathname.startsWith(`${messagesPath}/`)) {
    return null;
  }

  const unread = unreadQuery.data?.unread_count ?? 0;

  return (
    <Link
      aria-label={unread > 0 ? `Open messages, ${unread} unread` : 'Open messages'}
      className="chat-fab"
      to={messagesPath}>
      <svg className="chat-fab-icon" viewBox="0 0 24 24" aria-hidden fill="currentColor">
        <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9.4L5.7 20.3A1 1 0 0 1 4 19.5V6a2 2 0 0 1 2-2Z" />
      </svg>
      {unread > 0 ? (
        <span className="chat-fab-badge">{unread > 99 ? '99+' : unread}</span>
      ) : null}
    </Link>
  );
}
