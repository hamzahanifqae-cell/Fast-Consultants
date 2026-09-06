import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { LiquidMenu } from '@/components/liquid-menu';
import { StudentProgressReport } from '@/components/super-admin/student-progress-report';
import { WorkspaceGrid, type WorkspaceItem } from '@/components/super-admin/workspace-grid';
import { StudentScreen, StudentSurface } from '@/components/student/student-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { welcomeRoleTitle, welcomeTimestamp } from '@/lib/greeting';
import type { StudentProgressRow } from '@/lib/student-progress';
import { useChatUiStore } from '@/stores/chat-ui-store';
import type {
  AuthUser,
  ChatConversation,
  ConsultantSummary,
  StudentDocument,
  StudentNotificationsResponse,
  University,
} from '@/types/auth';

type Props = {
  user: AuthUser;
  token: string;
  onLogout: () => Promise<void>;
};

function initials(name: string | null | undefined) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function SuperAdminHome({ user, token, onLogout }: Props) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const openChat = useChatUiStore((state) => state.open);
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [inboxStudentId, setInboxStudentId] = useState<number | null>(null);

  const studentsQuery = useQuery({
    queryKey: ['consultant-students-progress'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentProgressRow[] }>(
        '/consultant/students/progress',
      );
      return data.data;
    },
  });

  const teamQuery = useQuery({
    queryKey: ['organization-users'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get<{ data: ConsultantSummary[] }>('/organization/users');
      return data.data;
    },
  });

  const universitiesQuery = useQuery({
    queryKey: ['consultant-universities'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get<{ data: University[] }>('/consultant/universities');
      return data.data;
    },
  });

  const messagesQuery = useQuery({
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

  const documentsQuery = useQuery({
    queryKey: ['consultant-documents-overview'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get<{ data: StudentDocument[] }>('/consultant/documents');
      return data.data;
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    enabled: Boolean(token),
    queryFn: async () => {
      const { data } = await api.get<StudentNotificationsResponse>('/notifications');
      return data;
    },
  });

  const students = studentsQuery.data ?? [];
  const team = teamQuery.data ?? [];
  const universities = universitiesQuery.data ?? [];
  const conversations = messagesQuery.data?.data ?? [];
  const documents = documentsQuery.data ?? [];
  const pendingDocs = documents.filter((doc) => doc.status === 'pending').length;
  const unreadMessages = messagesQuery.data?.unread_count ?? 0;
  const unreadNotices = notificationsQuery.data?.unread_count ?? 0;
  const inboxStudent = students.find((student) => student.id === inboxStudentId) ?? null;
  const inboxConversations = useMemo(() => {
    if (!inboxStudentId) return conversations;
    return conversations.filter((conversation) => conversation.other_user.id === inboxStudentId);
  }, [conversations, inboxStudentId]);

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['consultant-students-progress'] }),
      queryClient.invalidateQueries({ queryKey: ['organization-users'] }),
      queryClient.invalidateQueries({ queryKey: ['consultant-universities'] }),
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] }),
      queryClient.invalidateQueries({ queryKey: ['consultant-documents-overview'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
    setRefreshing(false);
  }

  const workspaceItems: WorkspaceItem[] = [
    {
      id: 'students',
      title: 'Students',
      subtitle: `${students.length} registered`,
      emoji: '🎓',
      tint: theme.cardLime,
      onPress: () => router.push('/consultant-students'),
    },
    {
      id: 'documents',
      title: 'Documents',
      subtitle: pendingDocs ? `${pendingDocs} pending review` : 'Review uploads',
      emoji: '📄',
      tint: theme.cardTeal,
      badge: pendingDocs || undefined,
      onPress: () => router.push('/departments/documents'),
    },
    {
      id: 'messages',
      title: 'Messages',
      subtitle: unreadMessages ? `${unreadMessages} unread` : 'All clear',
      emoji: '💬',
      tint: theme.cardCoral,
      badge: unreadMessages || undefined,
      onPress: () => openChat(),
    },
    {
      id: 'team',
      title: 'Team',
      subtitle: unreadNotices ? `${unreadNotices} notices` : `${team.length} members`,
      emoji: '👥',
      tint: theme.cardGold,
      badge: unreadNotices || undefined,
      onPress: () => router.push('/departments/team'),
    },
    {
      id: 'finance',
      title: 'Finance',
      subtitle: 'Charge slips & fees',
      emoji: '💳',
      tint: theme.cardGold,
      onPress: () => router.push('/departments/finance'),
    },
    {
      id: 'universities',
      title: 'Universities',
      subtitle: `${universities.length} in catalog`,
      emoji: '🏫',
      tint: theme.cardTeal,
      onPress: () => router.push('/departments/universities'),
    },
    {
      id: 'interview',
      title: 'Interview',
      subtitle: 'Prep & scheduling',
      emoji: '🎤',
      tint: theme.cardCoral,
      onPress: () => router.push('/departments/interview'),
    },
    {
      id: 'visa',
      title: 'Visa',
      subtitle: 'Embassy appointments',
      emoji: '🛂',
      tint: theme.cardLime,
      onPress: () => router.push('/departments/visa'),
    },
  ];

  const menuItems = [
    { emoji: '🎓', label: 'All students', onPress: () => router.push('/consultant-students') },
    { emoji: '📄', label: 'Documents', onPress: () => router.push('/departments/documents') },
    { emoji: '💳', label: 'Finance', onPress: () => router.push('/departments/finance') },
    { emoji: '🏫', label: 'Universities', onPress: () => router.push('/consultant-universities') },
    { emoji: '📚', label: 'Catalog', onPress: () => router.push('/consultant-universities-catalog') },
    { emoji: '🎤', label: 'Interview', onPress: () => router.push('/departments/interview') },
    { emoji: '🛂', label: 'Visa', onPress: () => router.push('/departments/visa') },
    { emoji: '👥', label: 'Team & access', onPress: () => router.push('/departments/team') },
    {
      emoji: '💬',
      label: 'Messages',
      badge: unreadMessages,
      onPress: () => openChat(),
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <StudentScreen
        contentStyle={styles.screenPad}
        onMenuPress={() => setMenuOpen(true)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />
        }
        showMenu
        title={welcomeRoleTitle('Super Admin')}
        subtitle={welcomeTimestamp()}>
        <StudentProgressReport
          loading={studentsQuery.isLoading}
          onSelectedStudentChange={setInboxStudentId}
          students={students}
        />

        <View style={styles.section}>
          <ThemedText type="section" themeColor="textSecondary">
            Workspace
          </ThemedText>
          <ThemedText themeColor="textSecondary">
            Students, departments, messages, and team, all in one place.
          </ThemedText>
          <WorkspaceGrid items={workspaceItems} />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionCopy}>
              <ThemedText type="section" themeColor="textSecondary">
                Inbox
              </ThemedText>
              <ThemedText themeColor="textSecondary">
                {inboxStudent
                  ? `Department chats with ${inboxStudent.name}.`
                  : 'Pick a student in the progress report to view their messages.'}
              </ThemedText>
            </View>
            <Pressable onPress={() => openChat(inboxConversations[0]?.id ?? null)}>
              <ThemedText type="smallBold">Open</ThemedText>
            </Pressable>
          </View>

          <StudentSurface style={styles.inbox}>
            {inboxConversations.slice(0, 5).map((conversation) => (
              <Pressable
                key={conversation.id}
                onPress={() => openChat(conversation.id)}
                style={({ pressed }) => [
                  styles.inboxRow,
                  pressed && { opacity: 0.85 },
                ]}>
                <View style={[styles.inboxAvatar, { backgroundColor: theme.cardLime }]}>
                  <ThemedText type="smallBold">
                    {initials(conversation.other_user.name)}
                  </ThemedText>
                </View>
                <View style={styles.inboxCopy}>
                  <ThemedText type="smallBold">{conversation.other_user.name}</ThemedText>
                  <ThemedText themeColor="textSecondary" numberOfLines={2}>
                    {conversation.department_label
                      ? `${conversation.department_label}, `
                      : ''}
                    {conversation.last_message?.body ?? 'No messages yet'}
                  </ThemedText>
                </View>
                {(conversation.unread_count ?? 0) > 0 ? (
                  <View style={[styles.unreadPill, { backgroundColor: theme.primary }]}>
                    <ThemedText type="caption" style={{ color: theme.onPrimary, fontWeight: '800' }}>
                      {conversation.unread_count}
                    </ThemedText>
                  </View>
                ) : null}
              </Pressable>
            ))}
            {!messagesQuery.isLoading && inboxConversations.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                {inboxStudent
                  ? `No messages from ${inboxStudent.name} yet.`
                  : 'No student messages yet.'}
              </ThemedText>
            ) : null}
          </StudentSurface>
        </View>

        <Pressable
          onPress={() => void onLogout()}
          style={[styles.logout, { backgroundColor: theme.inverted }]}>
          <ThemedText type="smallBold" style={{ color: theme.invertedText }}>
            Log out
          </ThemedText>
        </Pressable>
      </StudentScreen>

      <LiquidMenu
        items={menuItems}
        onClose={() => setMenuOpen(false)}
        onLogout={() => void onLogout()}
        visible={menuOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  screenPad: {
    paddingBottom: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  sectionCopy: {
    flex: 1,
    gap: 2,
  },
  inbox: {
    gap: Spacing.two,
  },
  inboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  inboxAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxCopy: {
    flex: 1,
    gap: 2,
  },
  unreadPill: {
    borderRadius: 999,
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'center',
  },
  logout: {
    alignSelf: 'center',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
});
