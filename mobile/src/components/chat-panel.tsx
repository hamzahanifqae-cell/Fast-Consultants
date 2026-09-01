import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { api, getApiErrorMessage } from '@/lib/api';
import { isSuperAdminUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { ChatConversation, ChatDepartment, ChatMessage } from '@/types/auth';

type ChatStyles = ReturnType<typeof createChatStyles>;

type ChatPanelProps = {
  visible: boolean;
  onClose: () => void;
  isConsultant: boolean;
  initialConversationId?: number | null;
};

type ViewMode = 'home' | 'pick' | 'thread';

export function ChatPanel({
  visible,
  onClose,
  isConsultant,
  initialConversationId = null,
}: ChatPanelProps) {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const styles = useMemo(() => createChatStyles(theme, colorScheme), [theme, colorScheme]);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const didAutoOpenUnread = useRef(false);
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = isSuperAdminUser(user);
  const isOrgWideViewer =
    isConsultant &&
    (isSuperAdmin ||
      Boolean(user?.is_admin) ||
      user?.roles?.includes('admin') ||
      user?.roles?.includes('consultant'));
  const isDepartmentStaff = isConsultant && !isSuperAdmin && !isOrgWideViewer;

  const [mode, setMode] = useState<ViewMode>('home');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setMode('home');
      setActiveId(null);
      setSelectedStudentId(null);
      setDraft('');
      setError(null);
      didAutoOpenUnread.current = false;
      return;
    }

    if (initialConversationId) {
      setActiveId(initialConversationId);
      setMode('thread');
      setDraft('');
      setError(null);
      didAutoOpenUnread.current = true;
      return;
    }

    setMode(isConsultant ? 'home' : 'pick');
    setActiveId(null);
    setSelectedStudentId(null);
  }, [visible, initialConversationId, isConsultant]);

  const conversationsQuery = useQuery({
    queryKey: ['chat-conversations'],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data } = await api.get<{ data: ChatConversation[]; unread_count: number }>(
        '/chat/conversations',
      );
      return data;
    },
  });

  const conversations = conversationsQuery.data?.data ?? [];
  const totalUnread = conversationsQuery.data?.unread_count ?? 0;

  useEffect(() => {
    if (!visible || !initialConversationId) {
      return;
    }

    const conversation = conversations.find((item) => item.id === initialConversationId);
    if (conversation) {
      setSelectedStudentId(conversation.other_user.id ?? null);
    }
  }, [visible, initialConversationId, conversations]);

  const groupedStudents = useMemo(() => {
    if (!isSuperAdmin && !isDepartmentStaff) {
      return [];
    }

    const byStudentId = new Map<
      number,
      {
        id: number;
        name: string;
        email: string;
        unreadCount: number;
        preview: string;
        lastMessageAt: string | null;
      }
    >();

    for (const conversation of conversations) {
      const student = conversation.other_user;
      if (student.id == null) continue;
      const existing = byStudentId.get(student.id);
      const unreadCount = (existing?.unreadCount ?? 0) + (conversation.unread_count ?? 0);
      const lastMessageAt =
        conversation.last_message_at ?? conversation.last_message?.created_at ?? null;
      const shouldReplace =
        !existing ||
        Boolean(
          lastMessageAt &&
            (!existing.lastMessageAt || lastMessageAt.localeCompare(existing.lastMessageAt) > 0),
        );

      byStudentId.set(student.id, {
        id: student.id,
        name: student.name ?? 'Student',
        email: student.email ?? '',
        unreadCount,
        preview: shouldReplace
          ? conversation.last_message
            ? conversation.last_message.mine
              ? `You: ${conversation.last_message.body}`
              : conversation.last_message.body
            : 'No messages yet'
          : (existing?.preview ?? 'No messages yet'),
        lastMessageAt: shouldReplace ? lastMessageAt : (existing?.lastMessageAt ?? null),
      });
    }

    return Array.from(byStudentId.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [conversations, isDepartmentStaff, isSuperAdmin]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) {
      return null;
    }

    return groupedStudents.find((student) => student.id === selectedStudentId) ?? null;
  }, [groupedStudents, selectedStudentId]);

  const selectedStudentConversations = useMemo(() => {
    if (!isSuperAdmin || !selectedStudentId) {
      return [];
    }

    return conversations.filter((conversation) => conversation.other_user.id === selectedStudentId);
  }, [conversations, isSuperAdmin, selectedStudentId]);

  const departmentsQuery = useQuery({
    queryKey: ['chat-departments'],
    enabled:
      visible &&
      mode === 'pick' &&
      ((!isConsultant && !isSuperAdmin) || (isSuperAdmin && selectedStudentId !== null)),
    queryFn: async () => {
      const { data } = await api.get<{ data: ChatDepartment[] }>('/chat/departments');
      return data.data;
    },
  });

  const threadQuery = useQuery({
    queryKey: ['chat-messages', activeId],
    enabled: visible && mode === 'thread' && activeId !== null,
    refetchInterval: visible && mode === 'thread' ? 1000 : false,
    queryFn: async () => {
      const { data } = await api.get<{
        data: {
          conversation: ChatConversation;
          messages: ChatMessage[];
          peer_typing: boolean;
        };
      }>(`/chat/conversations/${activeId}/messages`);
      return data.data;
    },
  });

  useEffect(() => {
    if (!threadQuery.isSuccess || activeId == null) {
      return;
    }

    queryClient.setQueryData(
      ['chat-conversations'],
      (current: { data: ChatConversation[]; unread_count: number } | undefined) => {
        if (!current) return current;
        const data = current.data.map((conversation) =>
          conversation.id === activeId ? { ...conversation, unread_count: 0 } : conversation,
        );
        return {
          ...current,
          data,
          unread_count: data.reduce((sum, item) => sum + (item.unread_count ?? 0), 0),
        };
      },
    );
    void queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [threadQuery.dataUpdatedAt, threadQuery.isSuccess, activeId, queryClient]);

  useEffect(() => {
    if (
      !visible ||
      initialConversationId ||
      didAutoOpenUnread.current ||
      isSuperAdmin ||
      isDepartmentStaff ||
      !isConsultant
    ) {
      return;
    }
    if (conversationsQuery.isLoading) {
      return;
    }

    didAutoOpenUnread.current = true;
    const firstUnread = conversations.find((conversation) => (conversation.unread_count ?? 0) > 0);
    if (firstUnread) {
      setActiveId(firstUnread.id);
      setMode('thread');
    }
  }, [visible, initialConversationId, conversations, conversationsQuery.isLoading]);
  const isTyping = draft.trim().length > 0;

  useEffect(() => {
    if (!visible || mode !== 'thread' || activeId === null) {
      return;
    }

    const conversationId = activeId;

    if (!isTyping) {
      void api.post(`/chat/conversations/${conversationId}/typing`, { typing: false }).catch(() => {
        // Typing is best-effort.
      });
      return;
    }

    void api.post(`/chat/conversations/${conversationId}/typing`, { typing: true }).catch(() => {
      // Typing is best-effort.
    });

    const interval = setInterval(() => {
      void api.post(`/chat/conversations/${conversationId}/typing`, { typing: true }).catch(() => {
        // Typing is best-effort.
      });
    }, 1500);

    return () => {
      clearInterval(interval);
      void api.post(`/chat/conversations/${conversationId}/typing`, { typing: false }).catch(() => {
        // Typing is best-effort.
      });
    };
  }, [visible, mode, activeId, isTyping]);

  useEffect(() => {
    if (threadQuery.data?.messages?.length || threadQuery.data?.peer_typing) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    }
  }, [threadQuery.data?.messages?.length, threadQuery.data?.peer_typing]);

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      const { data } = await api.post<{
        data: { conversation: ChatConversation; message: ChatMessage };
      }>(`/chat/conversations/${activeId}/messages`, { body });
      return data.data;
    },
    onSuccess: async () => {
      setDraft('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['chat-messages', activeId] });
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not send message.'));
    },
  });

  const toggleBlock = useMutation({
    mutationFn: async (blocked: boolean) => {
      if (!activeId) throw new Error('No conversation');
      if (blocked) {
        await api.delete(`/chat/conversations/${activeId}/block`);
      } else {
        await api.post(`/chat/conversations/${activeId}/block`);
      }
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['chat-messages', activeId] });
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not update chat block.'));
    },
  });

  const startChat = useMutation({
    mutationFn: async (department: string) => {
      const { data } = await api.post<{
        data: { conversation: ChatConversation; messages: ChatMessage[] };
      }>('/chat/conversations', {
        department,
      });
      return data.data;
    },
    onSuccess: async (payload) => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setActiveId(payload.conversation.id);
      setMode('thread');
    },
    onError: (err) => {
      setError(getApiErrorMessage(err, 'Could not start chat.'));
    },
  });

  function openSuperAdminDepartment(department: string) {
    const existing = selectedStudentConversations.find((item) => item.department === department);
    if (!existing) {
      return;
    }

    setError(null);
    setActiveId(existing.id);
    setMode('thread');
  }

  function selectStaffStudent(studentId: number) {
    const matches = conversations.filter((item) => item.other_user.id === studentId);
    const conversation = matches.sort((left, right) => {
      const leftAt = left.last_message_at ?? left.last_message?.created_at ?? '';
      const rightAt = right.last_message_at ?? right.last_message?.created_at ?? '';
      return rightAt.localeCompare(leftAt);
    })[0];

    if (!conversation) {
      return;
    }

    setError(null);
    setActiveId(conversation.id);
    setSelectedStudentId(studentId);
    setMode('thread');
  }

  function selectSuperAdminStudent(studentId: number) {
    setError(null);
    setActiveId(null);
    setSelectedStudentId(studentId);
    setMode('pick');
  }

  function goBackInInbox() {
    setError(null);
    setDraft('');

    if (isSuperAdmin) {
      if (mode === 'thread') {
        setActiveId(null);
        setMode('pick');
        return;
      }

      if (mode === 'pick') {
        setSelectedStudentId(null);
        setMode('home');
      }
      return;
    }

    if (isDepartmentStaff) {
      if (mode === 'thread') {
        setActiveId(null);
        setSelectedStudentId(null);
        setMode('home');
      }
      return;
    }

    if (!isConsultant) {
      if (mode === 'thread') {
        setActiveId(null);
        setMode('pick');
      }
      return;
    }

    setActiveId(null);
    setMode('home');
  }

  function openDepartment(department: string) {
    const existing = conversations.find((item) => item.department === department);
    if (existing) {
      setError(null);
      setActiveId(existing.id);
      setMode('thread');
      return;
    }
    startChat.mutate(department);
  }

  function confirmToggleBlock(currentlyBlocked: boolean) {
    Alert.alert(
      currentlyBlocked ? 'Unblock student chat?' : 'Block student chat?',
      currentlyBlocked
        ? 'They will be able to send messages again.'
        : 'This student will not be able to send chat messages. You can still message them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: currentlyBlocked ? 'Unblock' : 'Block',
          style: currentlyBlocked ? 'default' : 'destructive',
          onPress: () => toggleBlock.mutate(currentlyBlocked),
        },
      ],
    );
  }

  if (!visible) {
    return null;
  }

  const activeConversation =
    threadQuery.data?.conversation ?? conversations.find((item) => item.id === activeId);
  const isBlocked = Boolean(activeConversation?.is_blocked);
  const studentComposerLocked = !isConsultant && isBlocked;

  const studentName = activeConversation?.other_user?.name;
  const departmentLabel =
    activeConversation?.department_label ??
    conversations.find((item) => item.id === activeId)?.department_label;

  const headerTitle =
    mode === 'thread'
      ? isConsultant
        ? isSuperAdmin
          ? departmentLabel
            ? `${selectedStudent?.name ?? studentName ?? 'Student'} · ${departmentLabel}`
            : (selectedStudent?.name ?? studentName ?? 'Student chat')
          : isDepartmentStaff
            ? (selectedStudent?.name ?? studentName ?? 'Student chat')
            : studentName
              ? `Student: ${studentName}`
              : 'Student chat'
        : departmentLabel ?? studentName ?? 'Message Us'
      : isSuperAdmin
        ? mode === 'pick'
          ? selectedStudent?.name ?? 'Departments'
          : 'Select student'
        : isDepartmentStaff
          ? 'Select student'
          : isConsultant
            ? 'Student messages'
            : mode === 'pick'
              ? 'Choose a department'
              : 'Message Us';

  const inboxHelperText =
    totalUnread > 0
      ? isSuperAdmin
        ? `Pick a student to view department threads, ${totalUnread} unread`
        : isDepartmentStaff
          ? `Students who messaged your department, ${totalUnread} unread`
          : isOrgWideViewer
            ? `All student department threads, ${totalUnread} unread`
            : `Students who messaged your department, ${totalUnread} unread`
      : isSuperAdmin
        ? 'Pick a student, then choose a department to read their messages.'
        : isDepartmentStaff
          ? 'Pick a student to read and reply to their messages.'
          : isOrgWideViewer
            ? 'All student department threads across the organization'
            : 'Students who messaged your department';

  const emptyInboxText = isSuperAdmin
    ? 'No student messages yet.'
    : isDepartmentStaff
      ? 'No student messages for your department yet.'
      : isOrgWideViewer
        ? 'No student messages yet.'
        : 'No student messages for your department yet.';

  const footerLabel = isSuperAdmin
    ? mode === 'thread'
      ? 'Departments'
      : 'All students'
    : isDepartmentStaff
      ? 'All students'
      : isConsultant
        ? 'All students'
        : mode === 'thread'
          ? 'Departments'
          : 'Choose department';

  const headerIconTint = colorScheme === 'dark' ? theme.text : theme.invertedText;

  const showBackButton = isSuperAdmin
    ? mode !== 'home'
    : isDepartmentStaff
      ? mode === 'thread'
      : !isConsultant
        ? mode === 'thread'
        : mode !== 'home';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}>
      <View
        pointerEvents="box-none"
        style={styles.anchor}>
        <View style={styles.widget}>
          <View style={styles.header}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {headerTitle}
            </Text>
            <View style={styles.headerActions}>
              {showBackButton ? (
                <Pressable
                  accessibilityLabel="Go back"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={goBackInInbox}
                  style={({ pressed }) => [
                    styles.headerIconButton,
                    pressed && styles.headerIconButtonPressed,
                  ]}>
                  <SymbolView
                    name="chevron.left"
                    size={14}
                    tintColor={headerIconTint}
                    weight="semibold"
                  />
                </Pressable>
              ) : null}
              <Pressable
                accessibilityLabel="Minimize inbox"
                accessibilityRole="button"
                hitSlop={8}
                onPress={onClose}
                style={({ pressed }) => [
                  styles.headerIconButton,
                  pressed && styles.headerIconButtonPressed,
                ]}>
                <SymbolView
                  name="chevron.down"
                  size={13}
                  tintColor={headerIconTint}
                  weight="semibold"
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.body}>
            {mode === 'home' && (isConsultant || isSuperAdmin) ? (
              <View style={styles.homeBody}>
                {conversationsQuery.isLoading ? (
                  <ActivityIndicator color={theme.text} style={styles.centeredLoader} />
                ) : isSuperAdmin || isDepartmentStaff ? (
                  groupedStudents.length ? (
                    <ScrollView contentContainerStyle={styles.conversationList}>
                      <Text style={styles.helperText}>{inboxHelperText}</Text>
                      {groupedStudents.map((student) => (
                        <Pressable
                          key={student.id}
                          onPress={() =>
                            isSuperAdmin
                              ? selectSuperAdminStudent(student.id)
                              : selectStaffStudent(student.id)
                          }
                          style={styles.conversationRow}>
                          <View style={styles.conversationTop}>
                            <Text style={styles.conversationName}>{student.name}</Text>
                            {student.unreadCount > 0 ? (
                              <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>{student.unreadCount}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.conversationEmail} numberOfLines={1}>
                            {student.email}
                          </Text>
                          <Text style={styles.conversationPreview} numberOfLines={1}>
                            {student.preview}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyText}>{emptyInboxText}</Text>
                    </View>
                  )
                ) : conversations.length ? (
                  <ScrollView contentContainerStyle={styles.conversationList}>
                    {isConsultant ? (
                      <Text style={styles.helperText}>{inboxHelperText}</Text>
                    ) : (
                      <>
                        <Text style={styles.helperText}>
                          {totalUnread > 0
                            ? `Your chats, ${totalUnread} unread`
                            : 'Your chats'}
                        </Text>
                        <Pressable
                          onPress={() => {
                            setError(null);
                            setActiveId(null);
                            setMode('pick');
                          }}
                          style={styles.newChatButton}>
                          <Text style={styles.newChatButtonText}>Message a department</Text>
                        </Pressable>
                      </>
                    )}
                    {conversations.map((conversation) => (
                      <Pressable
                        key={conversation.id}
                        onPress={() => {
                          setError(null);
                          setActiveId(conversation.id);
                          setMode('thread');
                        }}
                        style={styles.conversationRow}>
                        <View style={styles.conversationTop}>
                          <Text style={styles.conversationName}>
                            {isConsultant
                              ? conversation.other_user?.name ?? 'Student'
                              : conversation.department_label ?? conversation.other_user?.name ?? 'Department'}
                          </Text>
                          <View style={styles.conversationBadges}>
                            {conversation.is_blocked ? (
                              <View style={styles.blockedBadge}>
                                <Text style={styles.blockedBadgeText}>Blocked</Text>
                              </View>
                            ) : null}
                            {(conversation.unread_count ?? 0) > 0 ? (
                              <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>
                                  {conversation.unread_count}
                                </Text>
                              </View>
                            ) : isConsultant && conversation.department_label ? (
                              <View style={styles.studentBadge}>
                                <Text style={styles.studentBadgeText}>
                                  {conversation.department_label}
                                </Text>
                              </View>
                            ) : isConsultant ? (
                              <View style={styles.studentBadge}>
                                <Text style={styles.studentBadgeText}>Student</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        {isConsultant ? (
                          <Text style={styles.conversationEmail} numberOfLines={1}>
                            {conversation.other_user?.email}
                            {conversation.department_label
                              ? `, ${conversation.department_label}`
                              : ''}
                          </Text>
                        ) : null}
                        <Text
                          style={[
                            styles.conversationPreview,
                            conversation.other_user_typing && styles.typingPreview,
                          ]}
                          numberOfLines={1}>
                          {conversation.other_user_typing
                            ? 'typing…'
                            : conversation.last_message
                              ? conversation.last_message.mine
                                ? `You: ${conversation.last_message.body}`
                                : conversation.last_message.body
                              : 'No messages yet'}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>
                      {isConsultant ? emptyInboxText : 'Choose a department to send a message.'}
                    </Text>
                    {!isConsultant ? (
                      <Pressable
                        onPress={() => {
                          setError(null);
                          setMode('pick');
                        }}
                        style={styles.newChatButton}>
                        <Text style={styles.newChatButtonText}>Message a department</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </View>
            ) : null}

            {mode === 'pick' && (!isConsultant || isSuperAdmin) ? (
              <ScrollView contentContainerStyle={styles.conversationList}>
                {isSuperAdmin ? (
                  <>
                    <Text style={styles.helperText}>
                      {selectedStudent
                        ? `Departments for ${selectedStudent.name}`
                        : 'Choose a department'}
                    </Text>
                    {departmentsQuery.isLoading ? <ActivityIndicator color={theme.text} /> : null}
                    {departmentsQuery.data?.map((department) => {
                      const existing = selectedStudentConversations.find(
                        (item) => item.department === department.value,
                      );
                      const unread = existing?.unread_count ?? 0;
                      return (
                        <Pressable
                          key={department.value}
                          disabled={!existing}
                          onPress={() => openSuperAdminDepartment(department.value)}
                          style={[
                            styles.conversationRow,
                            !existing && styles.conversationRowDisabled,
                          ]}>
                          <View style={styles.conversationTop}>
                            <Text style={styles.conversationName}>{department.label}</Text>
                            {unread > 0 ? (
                              <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>{unread}</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text
                            style={[
                              styles.conversationPreview,
                              existing?.other_user_typing && styles.typingPreview,
                            ]}
                            numberOfLines={1}>
                            {existing?.other_user_typing
                              ? 'typing…'
                              : existing?.last_message
                                ? existing.last_message.mine
                                  ? `You: ${existing.last_message.body}`
                                  : existing.last_message.body
                                : 'No conversation yet'}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </>
                ) : (
                  <>
                <Text style={styles.helperText}>
                  Choose the department you want to message. Only that team will see it.
                </Text>
                {departmentsQuery.isLoading ? <ActivityIndicator color={theme.text} /> : null}
                {departmentsQuery.data?.map((department) => {
                  const existing = conversations.find(
                    (item) => item.department === department.value,
                  );
                  const unread = existing?.unread_count ?? 0;
                  return (
                    <Pressable
                      key={department.value}
                      disabled={startChat.isPending}
                      onPress={() => openDepartment(department.value)}
                      style={styles.conversationRow}>
                      <View style={styles.conversationTop}>
                        <Text style={styles.conversationName}>{department.label}</Text>
                        {unread > 0 ? (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>{unread}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.conversationPreview,
                          existing?.other_user_typing && styles.typingPreview,
                        ]}
                        numberOfLines={1}>
                        {existing?.other_user_typing
                          ? 'typing…'
                          : existing?.last_message
                            ? existing.last_message.mine
                              ? `You: ${existing.last_message.body}`
                              : existing.last_message.body
                            : 'Tap to start a conversation'}
                      </Text>
                    </Pressable>
                  );
                })}
                  </>
                )}
              </ScrollView>
            ) : null}

            {mode === 'thread' ? (
              <View style={styles.thread}>
                {isConsultant && activeId ? (
                  <View style={styles.studentBanner}>
                    <Pressable
                      disabled={toggleBlock.isPending || !activeId}
                      onPress={() => confirmToggleBlock(isBlocked)}
                      style={[
                        styles.blockButton,
                        styles.blockButtonStandalone,
                        isBlocked ? styles.unblockButton : null,
                        (toggleBlock.isPending || !activeId) && styles.blockButtonDisabled,
                      ]}>
                      <Text
                        style={[
                          styles.blockButtonText,
                          isBlocked ? styles.unblockButtonText : null,
                        ]}>
                        {isBlocked ? 'Unblock chat' : 'Block chat'}
                      </Text>
                    </Pressable>
                  </View>
                ) : !isConsultant && departmentLabel ? (
                  <View style={styles.studentBanner}>
                    <Text style={styles.studentBannerTitle}>{departmentLabel}</Text>
                    <Text style={styles.studentBannerEmail}>
                      {isBlocked
                        ? 'Chat is blocked by staff. You can still read past messages.'
                        : 'Only this department can see this conversation.'}
                    </Text>
                  </View>
                ) : !isConsultant && isBlocked ? (
                  <View style={styles.studentBanner}>
                    <Text style={styles.blockedBannerText}>
                      Chat is blocked by staff. You can still read past messages.
                    </Text>
                  </View>
                ) : null}

                {threadQuery.isLoading ? (
                  <ActivityIndicator color={theme.text} style={styles.threadLoader} />
                ) : (
                  <FlatList
                    ref={listRef}
                    style={styles.messageList}
                    contentContainerStyle={styles.messages}
                    data={threadQuery.data?.messages ?? []}
                    extraData={threadQuery.data?.peer_typing}
                    keyExtractor={(item) => String(item.id)}
                    ListEmptyComponent={
                      threadQuery.data?.peer_typing ? null : (
                        <Text style={styles.emptyText}>Say hello to start the conversation.</Text>
                      )
                    }
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
                    renderItem={({ item }) => (
                      <View
                        style={[
                          styles.bubble,
                          item.mine ? styles.bubbleMine : styles.bubbleOther,
                        ]}>
                        {!item.mine ? (
                          <Text style={styles.bubbleSender}>{item.sender.name}</Text>
                        ) : null}
                        <Text style={[styles.bubbleText, item.mine && styles.bubbleTextMine]}>
                          {item.body}
                        </Text>
                      </View>
                    )}
                  />
                )}

                {threadQuery.data?.peer_typing ? <TypingIndicator styles={styles} /> : null}

                {error ? <Text style={styles.error}>{error}</Text> : null}

                <View style={styles.composer}>
                  <TextInput
                    editable={!studentComposerLocked}
                    multiline
                    onChangeText={setDraft}
                    placeholder={
                      studentComposerLocked ? 'Chat is blocked' : 'Type a message...'
                    }
                    placeholderTextColor={theme.textSecondary}
                    style={styles.composerInput}
                    value={draft}
                  />
                  <Pressable
                    disabled={
                      studentComposerLocked ||
                      draft.trim().length === 0 ||
                      sendMessage.isPending
                    }
                    onPress={() => sendMessage.mutate(draft.trim())}
                    style={[
                      styles.sendIcon,
                      {
                        opacity:
                          studentComposerLocked ||
                          draft.trim().length === 0 ||
                          sendMessage.isPending
                            ? 0.45
                            : 1,
                      },
                    ]}>
                    <SymbolView name="paperplane.fill" size={16} tintColor="#ffffff" />
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                setError(null);
                if (isSuperAdmin || isDepartmentStaff || !isConsultant) {
                  goBackInInbox();
                  return;
                }
                if (isConsultant) {
                  setMode('home');
                  return;
                }
              }}
              style={[
                styles.startButton,
                {
                  paddingTop: 7,
                  paddingBottom: insets.bottom > 0 ? Math.max(insets.bottom - 14, 8) : 7,
                },
              ]}>
              <Text style={styles.startButtonText}>{footerLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function TypingIndicator({ styles }: { styles: ChatStyles }) {
  const first = useRef(new Animated.Value(0.3)).current;
  const second = useRef(new Animated.Value(0.3)).current;
  const third = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const dots = [first, second, third];
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 280, useNativeDriver: true }),
          Animated.delay(320 - index * 80),
        ]),
      ),
    );

    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [first, second, third]);

  return (
    <View style={styles.typingRow}>
      <View style={[styles.bubble, styles.bubbleOther, styles.typingBubble]}>
        {[first, second, third].map((dot, index) => (
          <Animated.View key={index} style={[styles.typingDot, { opacity: dot }]} />
        ))}
      </View>
      <Text style={styles.typingLabel}>typing…</Text>
    </View>
  );
}

function createChatStyles(
  theme: (typeof Colors)['light'] | (typeof Colors)['dark'],
  colorScheme: 'light' | 'dark',
) {
  const headerBg = colorScheme === 'dark' ? theme.backgroundElement : theme.inverted;
  const headerText = colorScheme === 'dark' ? theme.text : theme.invertedText;

  return StyleSheet.create({
  anchor: {
    position: 'absolute',
    width: 320,
    maxWidth: '92%',
    right: 0,
    bottom: 0,
    zIndex: 20,
    justifyContent: 'flex-end',
  },
  widget: {
    height: 460,
    flexDirection: 'column',
    backgroundColor: theme.backgroundElement,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: -4, height: -4 },
    elevation: 8,
  },
  header: {
    backgroundColor: headerBg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerTitle: {
    flex: 1,
    color: headerText,
    fontSize: 16,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor:
      colorScheme === 'dark' ? theme.backgroundSelected : 'rgba(255, 255, 255, 0.14)',
  },
  headerIconButtonPressed: {
    opacity: 0.72,
  },
  body: {
    flex: 1,
    minHeight: 0,
    backgroundColor: theme.backgroundElement,
  },
  homeBody: {
    flex: 1,
  },
  centeredLoader: {
    marginTop: 40,
  },
  emptyState: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  emptyText: {
    color: theme.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  helperText: {
    color: theme.textSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
  newChatButton: {
    alignSelf: 'stretch',
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.inverted,
    marginBottom: 4,
  },
  newChatButtonText: {
    color: theme.invertedText,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  conversationList: {
    padding: 12,
    gap: 8,
  },
  conversationRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
    backgroundColor: theme.background,
  },
  conversationRowDisabled: {
    opacity: 0.55,
  },
  conversationTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  conversationBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  blockedBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: theme.dangerMuted,
  },
  blockedBadgeText: {
    color: theme.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  blockButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.dangerMuted,
  },
  blockButtonStandalone: {
    marginTop: 0,
  },
  unblockButton: {
    backgroundColor: theme.successMuted,
  },
  blockButtonDisabled: {
    opacity: 0.55,
  },
  blockButtonText: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: '700',
  },
  unblockButtonText: {
    color: theme.success,
  },
  blockedBannerText: {
    marginTop: 6,
    color: theme.warning,
    fontSize: 12,
    lineHeight: 16,
  },
  conversationName: {
    flex: 1,
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
  studentBadge: {
    backgroundColor: theme.successMuted,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  studentBadgeText: {
    color: theme.text,
    fontSize: 11,
    fontWeight: '700',
  },
  unreadBadge: {
    backgroundColor: theme.inverted,
    borderRadius: 999,
    minWidth: 22,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: theme.invertedText,
    fontSize: 11,
    fontWeight: '700',
  },
  conversationEmail: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  conversationPreview: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  typingPreview: {
    color: theme.text,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  studentBanner: {
    backgroundColor: theme.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  studentBannerTitle: {
    color: theme.text,
    fontSize: 13,
    fontWeight: '700',
  },
  studentBannerEmail: {
    color: theme.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  thread: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  threadLoader: {
    marginTop: 24,
  },
  messages: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
    flexGrow: 1,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  typingLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '600',
  },
  bubble: {
    maxWidth: '82%',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bubbleMine: {
    alignSelf: 'flex-end',
    backgroundColor: theme.accent,
  },
  bubbleOther: {
    alignSelf: 'flex-start',
    backgroundColor: theme.inputFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  bubbleSender: {
    color: theme.text,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 14,
    lineHeight: 19,
    color: theme.text,
  },
  bubbleTextMine: {
    color: theme.onPrimary,
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 58,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.textSecondary,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingBottom: 8,
    paddingTop: 4,
  },
  composerInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 90,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: theme.text,
    backgroundColor: theme.inputFill,
  },
  sendIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.inverted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    marginTop: 'auto',
    backgroundColor: theme.inverted,
  },
  startButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.inverted,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 0,
  },
  startButtonText: {
    color: theme.invertedText,
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    color: theme.danger,
    fontSize: 12,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  });
}
