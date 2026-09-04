import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppIcon } from '@/components/app-icon';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { resolveNotificationRoute } from '@/lib/notification-routes';
import { useTheme } from '@/hooks/use-theme';
import { useAuthStore } from '@/stores/auth-store';
import { useChatUiStore } from '@/stores/chat-ui-store';
import type { StudentNotification, StudentNotificationsResponse } from '@/types/auth';

export function StudentNotificationIcon() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const isStudent = useAuthStore((state) => state.user?.roles.includes('student') ?? false);
  const openChat = useChatUiStore((state) => state.open);
  const [open, setOpen] = useState(false);
  const scale = useSharedValue(1);

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    enabled: Boolean(token),
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await api.get<StudentNotificationsResponse>('/notifications', {
        params: { limit: 20 },
      });

      return data;
    },
  });

  const notifications = notificationsQuery.data?.data ?? [];
  const unreadCount = notificationsQuery.data?.unread_count ?? 0;
  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  const markAllReadMutation = useMutation({
    mutationFn: async () => api.patch('/notifications/mark-read'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  function closePanel() {
    setOpen(false);
    if (unreadCount > 0) {
      void markAllReadMutation.mutateAsync();
    }
  }

  function openPanel() {
    scale.value = withSequence(withSpring(0.88), withSpring(1.06), withSpring(1));
    setOpen(true);
  }

  function openNotification(item: StudentNotification) {
    setOpen(false);
    if (unreadCount > 0) {
      void markAllReadMutation.mutateAsync();
    }

    if (item.type === 'chat_message' || item.action === 'chat') {
      openChat(item.conversation_id ?? null);
      void queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      return;
    }

    const route = resolveNotificationRoute(item.action);
    if (route) {
      router.push(route as never);
    }
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <>
      <Animated.View style={animatedStyle}>
        <Pressable
          accessibilityLabel="Notifications"
          accessibilityRole="button"
          hitSlop={8}
          onPress={openPanel}
          style={[
            styles.iconButton,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}>
          <AppIcon name="bell.fill" size={20} tintColor={theme.text} />
          {unreadCount > 0 ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.primary,
                  borderColor: theme.backgroundElement,
                },
              ]}>
              <Text style={[styles.badgeText, { color: theme.onPrimary }]}>{badgeLabel}</Text>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>

      <Modal animationType="fade" transparent visible={open} onRequestClose={closePanel}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={closePanel} />
          <Animated.View
            style={[
              styles.sheet,
              { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}>
            <View style={[styles.sheetHeader, { borderBottomColor: theme.border }]}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Notifications</Text>
              <Pressable onPress={closePanel} hitSlop={8}>
                <Text style={[styles.done, { color: theme.primary }]}>Done</Text>
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
              {notifications.length ? (
                notifications.map((item) => (
                  <NotificationRow key={item.id} item={item} onPress={() => openNotification(item)} />
                ))
              ) : (
                <Text style={[styles.empty, { color: theme.textSecondary }]}>
                  {isStudent
                    ? 'No updates yet. Messages, approvals, and interview changes will show here.'
                    : 'No updates yet. New student messages will show here.'}
                </Text>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function NotificationRow({
  item,
  onPress,
}: {
  item: StudentNotification;
  onPress: () => void;
}) {
  const theme = useTheme();
  const unread = !item.read_at;
  const canOpen = Boolean(
    item.type === 'chat_message' ||
      item.action === 'chat' ||
      resolveNotificationRoute(item.action),
  );

  return (
    <Pressable
      accessibilityRole="button"
      disabled={!canOpen}
      onPress={onPress}
      style={[
        styles.row,
        { backgroundColor: unread ? theme.backgroundSelected : theme.background },
      ]}>
      <View style={[styles.dot, { backgroundColor: unread ? theme.primary : theme.border }]} />
      <View style={styles.rowCopy}>
        <Text style={[styles.rowMessage, { color: theme.text }]}>{item.message}</Text>
        {item.created_at ? (
          <Text style={[styles.rowTime, { color: theme.textSecondary }]}>
            {formatTime(item.created_at)}
          </Text>
        ) : null}
      </View>
      {canOpen ? (
        <Text style={[styles.chevron, { color: theme.textSecondary }]}>›</Text>
      ) : null}
    </Pressable>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  modalRoot: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(16, 18, 20, 0.4)',
  },
  sheet: {
    marginHorizontal: Spacing.four,
    marginTop: 72,
    maxHeight: '70%',
    borderRadius: 32,
    borderWidth: 0,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  done: {
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  empty: {
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 22,
    alignItems: 'flex-start',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  rowTime: {
    fontSize: 12,
  },
  chevron: {
    fontSize: 22,
    fontWeight: '300',
    marginTop: 0,
  },
});
