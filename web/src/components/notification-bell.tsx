import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { api } from '@/lib/api';
import { mapNotificationAction, StudentRoutes } from '@/lib/department-routes';
import { orgPortalForUser } from '@/lib/portals';
import { isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { UserNotification } from '@/types/auth';
import './notification-bell.css';

type NotificationsResponse = {
  data: UserNotification[];
  unread_count: number;
};

function resolveRoute(item: UserNotification, isTeam: boolean): string | null {
  const user = useAuthStore.getState().user;
  const portal = orgPortalForUser(user);

  if (item.type === 'chat_message' || item.action === 'chat') {
    return isTeam ? mapNotificationAction('/departments/messages', portal) : StudentRoutes.messages;
  }

  const mapped = mapNotificationAction(item.action, portal);
  if (mapped) {
    return mapped;
  }

  const mobileToWeb: Record<string, string> = {
    '/student-charge-receipts': StudentRoutes.chargeReceipts,
    '/student-preparation': StudentRoutes.preparation,
    '/student-interview': StudentRoutes.interview,
    '/student-status': StudentRoutes.status,
    '/student-documents': StudentRoutes.documents,
    '/student-universities': StudentRoutes.universities,
    '/student-visa-appointments': StudentRoutes.visaAppointments,
  };

  if (item.action && mobileToWeb[item.action]) {
    return mobileToWeb[item.action];
  }

  return null;
}

function formatTime(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function NotificationBell() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isTeam = isOrganizationUser(user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    enabled: Boolean(token),
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await api.get<NotificationsResponse>('/notifications', {
        params: { limit: 20 },
      });
      return data;
    },
  });

  const markAllRead = useMutation({
    mutationFn: async () => api.patch('/notifications/mark-read'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = notificationsQuery.data?.data ?? [];
  const unreadCount = notificationsQuery.data?.unread_count ?? 0;
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', onPointerDown);
    }

    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function closeAndMarkRead() {
    setOpen(false);
    if (unreadCount > 0) {
      markAllRead.mutate();
    }
  }

  function openItem(item: UserNotification) {
    const route = resolveRoute(item, isTeam);
    closeAndMarkRead();
    if (route) {
      navigate(route);
    }
    if (item.type === 'chat_message' || item.action === 'chat') {
      void queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  }

  return (
    <div className="notif-bell" ref={rootRef}>
      <button
        type="button"
        className="notif-trigger"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}>
        <svg className="notif-icon" viewBox="0 0 24 24" aria-hidden fill="currentColor">
          <path d="M12 2a5 5 0 0 0-5 5v2.26c0 .7-.28 1.37-.78 1.86L4.3 13.7a1 1 0 0 0 .7 1.7h13.99a1 1 0 0 0 .71-1.71l-1.92-1.92A2.63 2.63 0 0 1 17 9.26V7a5 5 0 0 0-5-5Zm0 20a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Z" />
        </svg>
        {unreadCount > 0 ? <span className="notif-badge">{badgeLabel}</span> : null}
      </button>

      {open ? (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-panel-head">
            <strong>Notifications</strong>
            <button type="button" className="notif-done" onClick={closeAndMarkRead}>
              Done
            </button>
          </div>
          <div className="notif-list">
            {notifications.length ? (
              notifications.map((item) => {
                const canOpen = Boolean(resolveRoute(item, isTeam));
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`notif-row${item.read_at ? '' : ' unread'}${canOpen ? '' : ' static'}`}
                    onClick={() => openItem(item)}
                    disabled={!canOpen}>
                    <span className={`notif-dot${item.read_at ? '' : ' live'}`} />
                    <span className="notif-copy">
                      <span className="notif-message">{item.message}</span>
                      {item.created_at ? (
                        <span className="notif-time">{formatTime(item.created_at)}</span>
                      ) : null}
                    </span>
                    {canOpen ? <span className="notif-chevron">›</span> : null}
                  </button>
                );
              })
            ) : (
              <p className="notif-empty">
                {isTeam
                  ? 'No updates yet. Messages and student activity for your role will show here.'
                  : 'No updates yet. Messages, approvals, and interview changes will show here.'}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
