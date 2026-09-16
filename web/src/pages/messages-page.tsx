import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { InlinePageLoader } from '@/components/app-loader';
import { DirectoryList } from '@/components/directory-list';
import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { openAuthenticatedFile } from '@/lib/open-authenticated-file';
import { isSuperAdminUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { ChatConversation, ChatStudentBlock, UserNotification } from '@/types/auth';
import './dashboard.css';

type ChatAttachment = {
  name: string | null;
  mime_type: string | null;
  size: number | null;
  download_path: string;
};

type ChatMessage = {
  id: number;
  body: string | null;
  mine: boolean;
  sender: { id: number; name: string };
  created_at: string | null;
  attachment?: ChatAttachment | null;
};

type ChatDepartment = {
  value: string;
  label: string;
};

type MessagesPageProps = {
  isConsultant: boolean;
};

type StaffListTab = 'inbox' | 'team' | 'blocked';
type InboxPanel = 'menu' | 'students' | 'broadcast';

type StaffDirectoryMember = {
  id: number | null;
  name: string;
  email: string | null;
  staff_department: string | null;
  staff_department_label: string | null;
  available?: boolean;
};

type BroadcastStudent = {
  id: number;
  name: string;
  email: string;
};

export function MessagesPage({ isConsultant }: MessagesPageProps) {
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = isSuperAdminUser(user);
  const isAdminViewer =
    isConsultant &&
    (isSuperAdmin || Boolean(user?.is_admin) || Boolean(user?.roles?.includes('admin')));
  const isDepartmentStaff = isConsultant && !isSuperAdmin && !isAdminViewer;
  const [activeId, setActiveId] = useState<number | null>(null);
  const [pendingDepartment, setPendingDepartment] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [staffListTab, setStaffListTab] = useState<StaffListTab>('inbox');
  const [inboxPanel, setInboxPanel] = useState<InboxPanel>('menu');
  const [broadcastStudentIds, setBroadcastStudentIds] = useState<number[]>([]);
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [broadcastDepartment, setBroadcastDepartment] = useState('');
  const [broadcastSearch, setBroadcastSearch] = useState('');
  const [broadcastNotice, setBroadcastNotice] = useState<string | null>(null);
  const [awaitingScheduledSince, setAwaitingScheduledSince] = useState<string | null>(null);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [broadcastAttachmentFile, setBroadcastAttachmentFile] = useState<File | null>(null);
  const [scheduleAt, setScheduleAt] = useState('');
  const [broadcastScheduleAt, setBroadcastScheduleAt] = useState('');
  const [showScheduleMenu, setShowScheduleMenu] = useState(false);
  const [showBroadcastScheduleMenu, setShowBroadcastScheduleMenu] = useState(false);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const broadcastAttachmentInputRef = useRef<HTMLInputElement>(null);
  const scheduleDropdownRef = useRef<HTMLDivElement>(null);
  const broadcastScheduleDropdownRef = useRef<HTMLDivElement>(null);
  const needsBroadcastDepartment = isAdminViewer;
  const showBroadcast = inboxPanel === 'broadcast';

  useEffect(() => {
    if (!showScheduleMenu && !showBroadcastScheduleMenu) {
      return;
    }

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      const target = event.target as Node | null;
      if (!target) {
        return;
      }

      if (
        showScheduleMenu &&
        scheduleDropdownRef.current &&
        !scheduleDropdownRef.current.contains(target)
      ) {
        setShowScheduleMenu(false);
      }

      if (
        showBroadcastScheduleMenu &&
        broadcastScheduleDropdownRef.current &&
        !broadcastScheduleDropdownRef.current.contains(target)
      ) {
        setShowBroadcastScheduleMenu(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showScheduleMenu, showBroadcastScheduleMenu]);

  const departmentsQuery = useQuery({
    queryKey: ['chat-departments'],
    enabled:
      !isConsultant ||
      (isAdminViewer && selectedStudentId !== null) ||
      (showBroadcast && needsBroadcastDepartment),
    queryFn: async () => {
      const { data } = await api.get<{ data: ChatDepartment[] }>('/chat/departments');
      return data.data;
    },
  });

  const conversationsQuery = useQuery({
    queryKey: ['chat-conversations'],
    refetchInterval: 2500,
    queryFn: async () => {
      const { data } = await api.get<{ data: ChatConversation[]; unread_count: number }>(
        '/chat/conversations',
      );
      return data;
    },
  });

  const conversations = conversationsQuery.data?.data ?? [];
  const studentConversations = useMemo(
    () => conversations.filter((conversation) => conversation.kind !== 'staff_dm'),
    [conversations],
  );
  const staffDmConversations = useMemo(
    () =>
      conversations
        .filter((conversation) => conversation.kind === 'staff_dm')
        .sort((left, right) => {
          const leftAt = left.last_message_at ?? left.last_message?.created_at ?? '';
          const rightAt = right.last_message_at ?? right.last_message?.created_at ?? '';
          return rightAt.localeCompare(leftAt);
        }),
    [conversations],
  );

  const blocksQuery = useQuery({
    queryKey: ['chat-blocks'],
    enabled: isConsultant,
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await api.get<{ data: ChatStudentBlock[] }>('/chat/blocks');
      return data.data;
    },
  });

  const staffDirectoryQuery = useQuery({
    queryKey: ['chat-staff-directory'],
    enabled: isConsultant && staffListTab === 'team',
    queryFn: async () => {
      const { data } = await api.get<{ data: StaffDirectoryMember[] }>('/chat/staff/directory');
      return data.data;
    },
  });

  const broadcastStudentsQuery = useQuery({
    queryKey: ['consultant-students'],
    enabled: isConsultant && (showBroadcast || inboxPanel === 'students'),
    queryFn: async () => {
      const { data } = await api.get<{ data: BroadcastStudent[] }>('/consultant/students');
      return data.data;
    },
  });

  const blockedStudents = blocksQuery.data ?? [];
  const staffDirectory = staffDirectoryQuery.data ?? [];
  const broadcastStudents = broadcastStudentsQuery.data ?? [];
  const directoryStudents = broadcastStudents;
  const filteredBroadcastStudents = useMemo(() => {
    const query = broadcastSearch.trim().toLowerCase();
    if (!query) {
      return broadcastStudents;
    }

    return broadcastStudents.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        student.email.toLowerCase().includes(query),
    );
  }, [broadcastStudents, broadcastSearch]);
  const teamUnread = staffDmConversations.reduce(
    (sum, conversation) => sum + (conversation.unread_count ?? 0),
    0,
  );

  const groupedStudents = useMemo(() => {
    if (!isConsultant) {
      return [];
    }

    const blockedIds = new Set(
      blockedStudents
        .map((block) => block.student_id ?? block.student?.id)
        .filter((id): id is number => typeof id === 'number'),
    );

    const byStudentId = new Map<
      number,
      {
        id: number;
        name: string;
        email: string;
        unreadCount: number;
        preview: string;
        lastMessageAt: string | null;
        isBlocked: boolean;
      }
    >();

    for (const student of directoryStudents) {
      if (blockedIds.has(student.id)) continue;
      byStudentId.set(student.id, {
        id: student.id,
        name: student.name,
        email: student.email,
        unreadCount: 0,
        preview: 'No messages yet',
        lastMessageAt: null,
        isBlocked: false,
      });
    }

    for (const conversation of studentConversations) {
      const student = conversation.other_user;
      if (student.id == null) continue;
      if (blockedIds.has(student.id)) continue;

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
        name: student.name ?? existing?.name ?? 'Student',
        email: student.email ?? existing?.email ?? '',
        unreadCount,
        preview: shouldReplace
          ? (conversation.last_message?.body ?? existing?.preview ?? 'No messages yet')
          : (existing?.preview ?? 'No messages yet'),
        lastMessageAt: shouldReplace ? lastMessageAt : (existing?.lastMessageAt ?? null),
        isBlocked: Boolean(existing?.isBlocked || conversation.is_blocked),
      });
    }

    return Array.from(byStudentId.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [directoryStudents, studentConversations, blockedStudents, isConsultant]);

  const inboxGroupedStudents = useMemo(
    () => groupedStudents.filter((student) => !student.isBlocked),
    [groupedStudents],
  );

  const selectedStudent = useMemo(
    () => groupedStudents.find((student) => student.id === selectedStudentId) ?? null,
    [groupedStudents, selectedStudentId],
  );

  const selectedStudentConversations = useMemo(() => {
    if (!isAdminViewer || !selectedStudentId) {
      return [];
    }

    return studentConversations.filter(
      (conversation) => conversation.other_user.id === selectedStudentId,
    );
  }, [studentConversations, isAdminViewer, selectedStudentId]);

  const threadQuery = useQuery({
    queryKey: ['chat-messages', activeId],
    enabled: activeId !== null,
    refetchInterval: activeId ? 1000 : false,
    queryFn: async () => {
      const { data } = await api.get<{
        data: { conversation: ChatConversation; messages: ChatMessage[]; peer_typing: boolean };
      }>(`/chat/conversations/${activeId}/messages`);
      return data.data;
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ['notifications'],
    enabled: isConsultant && Boolean(awaitingScheduledSince),
    refetchInterval: awaitingScheduledSince ? 2000 : false,
    queryFn: async () => {
      const { data } = await api.get<{ data: UserNotification[]; unread_count: number }>(
        '/notifications',
        { params: { limit: 20 } },
      );
      return data;
    },
  });

  useEffect(() => {
    if (!awaitingScheduledSince) return;
    const sinceMs = new Date(awaitingScheduledSince).getTime();
    const hit = (notificationsQuery.data?.data ?? []).find((item) => {
      if (item.type !== 'chat_scheduled_sent') return false;
      if (!item.created_at) return true;
      return new Date(item.created_at).getTime() >= sinceMs - 1000;
    });
    if (!hit) return;
    setBroadcastNotice(hit.message);
    setAwaitingScheduledSince(null);
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [awaitingScheduledSince, notificationsQuery.data, queryClient]);

  useEffect(() => {
    if (!threadQuery.isSuccess || activeId == null) return;

    const opened = threadQuery.data?.conversation;
    const openedStudentId =
      opened && opened.kind !== 'staff_dm' ? opened.other_user?.id : null;
    const clearAllStudentThreads = Boolean(isAdminViewer && openedStudentId);

    queryClient.setQueryData(
      ['chat-conversations'],
      (current: { data: ChatConversation[]; unread_count: number } | undefined) => {
        if (!current) return current;
        const data = current.data.map((conversation) => {
          if (conversation.id === activeId) {
            return { ...conversation, unread_count: 0 };
          }
          if (
            clearAllStudentThreads &&
            conversation.kind !== 'staff_dm' &&
            conversation.other_user?.id === openedStudentId
          ) {
            return { ...conversation, unread_count: 0 };
          }
          return conversation;
        });
        return {
          ...current,
          data,
          unread_count: data.reduce((sum, item) => sum + (item.unread_count ?? 0), 0),
        };
      },
    );
  }, [threadQuery.isSuccess, threadQuery.data?.conversation, activeId, isAdminViewer, queryClient]);

  // Refresh conversation badges once after opening a thread (server marks it read).
  useEffect(() => {
    if (activeId == null) return;
    const timer = window.setTimeout(() => {
      void queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [activeId, queryClient]);

  useEffect(() => {
    if (
      activeId ||
      conversationsQuery.isLoading ||
      !conversations.length ||
      isSuperAdmin ||
      isDepartmentStaff ||
      !isConsultant
    ) {
      return;
    }

    const firstUnread = conversations.find((conversation) => (conversation.unread_count ?? 0) > 0);
    if (firstUnread) {
      setActiveId(firstUnread.id);
      return;
    }

    if (isConsultant) {
      setActiveId(conversations[0].id);
    }
  }, [activeId, conversations, conversationsQuery.isLoading, isConsultant]);

  const startChat = useMutation({
    mutationFn: async (department: string) => {
      const existing = studentConversations.find((item) => item.department === department);
      if (existing) return { conversation: existing, created: false as const };

      const { data } = await api.post<{
        data: { conversation: ChatConversation | null; department?: string; department_label?: string };
      }>('/chat/conversations', { department });

      return {
        conversation: data.data.conversation,
        department: data.data.department ?? department,
        departmentLabel: data.data.department_label,
        created: false as const,
      };
    },
    onSuccess: async (payload) => {
      setError(null);
      if (payload.conversation) {
        setPendingDepartment(null);
        setActiveId(payload.conversation.id);
        await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
        return;
      }

      // No thread yet — keep a local selection until the student sends a message.
      setActiveId(null);
      setPendingDepartment(payload.department ?? null);
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not start chat.')),
  });

  const startStaffChat = useMutation({
    mutationFn: async (peerUserId: number) => {
      const existing = staffDmConversations.find((item) => item.other_user.id === peerUserId);
      if (existing) return existing;

      const { data } = await api.post<{
        data: { conversation: ChatConversation };
      }>('/chat/staff/conversations', { peer_user_id: peerUserId });
      return data.data.conversation;
    },
    onSuccess: async (conversation) => {
      setError(null);
      setStaffListTab('team');
      setSelectedStudentId(null);
      setActiveId(conversation.id);
      queryClient.setQueryData<{ data: ChatConversation[]; unread_count: number }>(
        ['chat-conversations'],
        (current) => {
          if (!current) {
            return { data: [conversation], unread_count: 0 };
          }

          const alreadyListed = current.data.some((item) => item.id === conversation.id);
          return {
            ...current,
            data: alreadyListed
              ? current.data.map((item) => (item.id === conversation.id ? conversation : item))
              : [conversation, ...current.data],
          };
        },
      );
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['chat-messages', conversation.id] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not start staff chat.')),
  });

  const startStudentThread = useMutation({
    mutationFn: async ({
      studentId,
      department,
    }: {
      studentId: number;
      department?: string;
    }) => {
      const existing = studentConversations.find(
        (item) =>
          item.other_user.id === studentId &&
          (!department || item.department === department),
      );
      if (existing) return existing;

      const { data } = await api.post<{
        data: { conversation: ChatConversation };
      }>('/chat/staff/student-conversations', {
        student_id: studentId,
        ...(department ? { department } : {}),
      });
      return data.data.conversation;
    },
    onSuccess: async (conversation) => {
      setError(null);
      setSelectedStudentId(conversation.other_user.id ?? selectedStudentId);
      setActiveId(conversation.id);
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['chat-messages', conversation.id] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not open student chat.')),
  });

  const sendMessage = useMutation({
    mutationFn: async ({
      body,
      file,
      scheduledAt,
    }: {
      body: string;
      file: File | null;
      scheduledAt: string;
    }) => {
      let conversationId = activeId;

      if (!conversationId && pendingDepartment && !isConsultant) {
        const opener = body.trim() || (file ? 'Attachment' : '');
        if (!opener) {
          throw new Error('Message required');
        }

        const { data: started } = await api.post<{
          data: { conversation: ChatConversation };
        }>('/chat/conversations', {
          department: pendingDepartment,
          message: opener,
        });
        conversationId = started.data.conversation.id;

        if (file) {
          const formData = new FormData();
          formData.append('body', body.trim() && body.trim() !== opener ? body.trim() : '');
          formData.append('attachment', file);
          await api.post(`/chat/conversations/${conversationId}/messages`, formData);
        }

        return { conversationId };
      }

      if (!conversationId) {
        throw new Error('No conversation');
      }

      const formData = new FormData();
      formData.append('body', body);
      if (file) {
        formData.append('attachment', file);
      }
      if (scheduledAt) {
        formData.append('scheduled_at', new Date(scheduledAt).toISOString());
      }
      const { data } = await api.post<{
        data: { scheduled?: boolean; scheduled_at?: string };
      }>(`/chat/conversations/${conversationId}/messages`, formData);
      return { ...data.data, conversationId };
    },
    onSuccess: async (payload) => {
      setDraft('');
      setAttachmentFile(null);
      setScheduleAt('');
      setShowScheduleMenu(false);
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = '';
      }
      setError(null);
      if (payload.conversationId) {
        setActiveId(payload.conversationId);
        setPendingDepartment(null);
      }
      if (payload.scheduled) {
        setBroadcastNotice(
          `Message scheduled for ${payload.scheduled_at ? new Date(payload.scheduled_at).toLocaleString() : 'later'}.`,
        );
        setAwaitingScheduledSince(new Date().toISOString());
      }
      await queryClient.invalidateQueries({
        queryKey: ['chat-messages', payload.conversationId ?? activeId],
      });
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not send message.')),
  });

  const sendWhatsApp = useMutation({
    mutationFn: async ({ body, file }: { body: string; file: File | null }) => {
      const formData = new FormData();
      formData.append('body', body);
      if (file) {
        formData.append('attachment', file);
      }
      const { data } = await api.post<{
        data: {
          conversation: ChatConversation;
          message: ChatMessage;
          whatsapp: { sent: boolean; mode: string; to?: string; from?: string | null };
        };
      }>(`/chat/conversations/${activeId}/whatsapp`, formData);
      return data.data;
    },
    onSuccess: async (payload) => {
      setDraft('');
      setAttachmentFile(null);
      setScheduleAt('');
      setShowScheduleMenu(false);
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = '';
      }
      setError(null);
      const to = payload.whatsapp?.to ? `+${payload.whatsapp.to}` : 'the student phone';
      const from = payload.whatsapp?.from ? ` from ${payload.whatsapp.from}` : '';
      setBroadcastNotice(
        `WhatsApp accepted text to ${to}${from}. On the phone, open the chat with that business number (not a personal contact). If nothing appears, send any message to the business number first, then retry.`,
      );
      await queryClient.invalidateQueries({ queryKey: ['chat-messages', activeId] });
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not send WhatsApp message.')),
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
    onSuccess: async (_data, blocked) => {
      setError(null);
      if (!blocked) {
        setActiveId(null);
        setSelectedStudentId(null);
        setStaffListTab('blocked');
      } else {
        setStaffListTab('inbox');
      }
      await queryClient.invalidateQueries({ queryKey: ['chat-messages', activeId] });
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['chat-blocks'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not update chat block.')),
  });

  const unblockStudent = useMutation({
    mutationFn: async (studentId: number) => {
      await api.delete(`/chat/blocks/${studentId}`);
    },
    onSuccess: async () => {
      setError(null);
      setStaffListTab('inbox');
      await queryClient.invalidateQueries({ queryKey: ['chat-blocks'] });
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not unblock student.')),
  });

  const broadcastMessage = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      broadcastStudentIds.forEach((id) => formData.append('student_ids[]', String(id)));
      formData.append('message', broadcastDraft.trim());
      if (needsBroadcastDepartment && broadcastDepartment) {
        formData.append('department', broadcastDepartment);
      }
      if (broadcastAttachmentFile) {
        formData.append('attachment', broadcastAttachmentFile);
      }
      if (broadcastScheduleAt) {
        formData.append('scheduled_at', new Date(broadcastScheduleAt).toISOString());
      }
      const { data } = await api.post<{
        data: {
          sent_count: number;
          skipped_blocked_count: number;
          conversation_ids: number[];
          scheduled?: boolean;
          scheduled_at?: string;
        };
      }>('/chat/broadcast', formData);
      return data.data;
    },
    onSuccess: async (payload) => {
      setError(null);
      if (payload.scheduled) {
        setBroadcastNotice(
          `Broadcast scheduled for ${payload.scheduled_at ? new Date(payload.scheduled_at).toLocaleString() : 'later'}.`,
        );
        setAwaitingScheduledSince(new Date().toISOString());
      } else {
        const skipped =
          payload.skipped_blocked_count > 0
            ? ` Skipped ${payload.skipped_blocked_count} blocked.`
            : '';
        setBroadcastNotice(
          `Sent to ${payload.sent_count} student${payload.sent_count === 1 ? '' : 's'}.${skipped}`,
        );
      }
      setBroadcastDraft('');
      setBroadcastStudentIds([]);
      setBroadcastSearch('');
      setBroadcastAttachmentFile(null);
      setBroadcastScheduleAt('');
      setShowBroadcastScheduleMenu(false);
      if (broadcastAttachmentInputRef.current) {
        broadcastAttachmentInputRef.current.value = '';
      }
      setInboxPanel('menu');
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not send broadcast.')),
  });

  const broadcastWhatsApp = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      broadcastStudentIds.forEach((id) => formData.append('student_ids[]', String(id)));
      formData.append('message', broadcastDraft.trim());
      if (needsBroadcastDepartment && broadcastDepartment) {
        formData.append('department', broadcastDepartment);
      }
      if (broadcastAttachmentFile) {
        formData.append('attachment', broadcastAttachmentFile);
      }
      const { data } = await api.post<{
        data: {
          sent_count: number;
          skipped_blocked_count: number;
          whatsapp?: { sent_count: number; failed_count: number };
        };
      }>('/chat/broadcast/whatsapp', formData);
      return data.data;
    },
    onSuccess: (payload) => {
      setError(null);
      const wa = payload.whatsapp;
      const skipped =
        payload.skipped_blocked_count > 0
          ? ` Skipped ${payload.skipped_blocked_count} blocked.`
          : '';
      const waNote = wa
        ? ` WhatsApp: ${wa.sent_count} sent${wa.failed_count ? `, ${wa.failed_count} failed` : ''}.`
        : '';
      setBroadcastNotice(
        `Sent to ${payload.sent_count} student${payload.sent_count === 1 ? '' : 's'}.${skipped}${waNote}`,
      );
      setBroadcastDraft('');
      setBroadcastAttachmentFile(null);
      setBroadcastStudentIds([]);
      setBroadcastSearch('');
      if (broadcastAttachmentInputRef.current) {
        broadcastAttachmentInputRef.current.value = '';
      }
      setInboxPanel('menu');
      void queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not send WhatsApp broadcast.')),
  });

  function openBroadcastPanel() {
    setError(null);
    setBroadcastNotice(null);
    setAwaitingScheduledSince(null);
    setActiveId(null);
    setSelectedStudentId(null);
    setInboxPanel('broadcast');
  }

  function openStudentsPanel() {
    setError(null);
    setBroadcastNotice(null);
    setAwaitingScheduledSince(null);
    setActiveId(null);
    setSelectedStudentId(null);
    setInboxPanel('students');
  }

  function goBackToInboxMenu() {
    setError(null);
    setActiveId(null);
    setSelectedStudentId(null);
    setInboxPanel('menu');
    setBroadcastDraft('');
    setBroadcastStudentIds([]);
    setBroadcastSearch('');
    setBroadcastAttachmentFile(null);
    setBroadcastScheduleAt('');
    setShowBroadcastScheduleMenu(false);
    if (broadcastAttachmentInputRef.current) {
      broadcastAttachmentInputRef.current.value = '';
    }
  }

  function toggleBroadcastStudent(studentId: number) {
    setBroadcastStudentIds((current) =>
      current.includes(studentId)
        ? current.filter((id) => id !== studentId)
        : [...current, studentId],
    );
  }

  const isTyping = draft.trim().length > 0;

  useEffect(() => {
    if (!activeId) return;

    if (!isTyping) {
      void api.post(`/chat/conversations/${activeId}/typing`, { typing: false }).catch(() => {
        // Typing is best-effort.
      });
      return;
    }

    void api.post(`/chat/conversations/${activeId}/typing`, { typing: true }).catch(() => {
      // Typing is best-effort.
    });

    const interval = setInterval(() => {
      void api.post(`/chat/conversations/${activeId}/typing`, { typing: true }).catch(() => {
        // Typing is best-effort.
      });
    }, 1500);

    return () => {
      clearInterval(interval);
      void api.post(`/chat/conversations/${activeId}/typing`, { typing: false }).catch(() => {
        // Typing is best-effort.
      });
    };
  }, [activeId, isTyping]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (studentComposerLocked) return;
    if (!activeId && !(pendingDepartment && !isConsultant)) return;
    if (!draft.trim() && !attachmentFile) return;
    sendMessage.mutate({
      body: draft.trim(),
      file: attachmentFile,
      scheduledAt: isConsultant ? scheduleAt : '',
    });
  }

  async function openChatAttachment(attachment: ChatAttachment) {
    try {
      await openAuthenticatedFile(attachment.download_path, attachment.name ?? 'Attachment');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not open attachment.'));
    }
  }

  const activeConversation =
    threadQuery.data?.conversation ??
    conversations.find((conversation) => conversation.id === activeId);
  const pendingDepartmentMeta = pendingDepartment
    ? (departmentsQuery.data?.find((item) => item.value === pendingDepartment) ?? null)
    : null;
  const composerReady = Boolean(activeId) || Boolean(pendingDepartment && !isConsultant);
  const isBlocked = Boolean(activeConversation?.is_blocked);
  const studentComposerLocked = !isConsultant && isBlocked;
  const canSendWhatsApp =
    isConsultant &&
    Boolean(activeId) &&
    !studentComposerLocked &&
    !scheduleAt &&
    (draft.trim().length > 0 || Boolean(attachmentFile)) &&
    (activeConversation?.kind !== 'student_department' ||
      Boolean(activeConversation?.other_user?.phone));

  function onSendWhatsApp() {
    if (!canSendWhatsApp) return;
    sendWhatsApp.mutate({ body: draft.trim(), file: attachmentFile });
  }

  const canBroadcastWhatsApp =
    isConsultant &&
    !broadcastScheduleAt &&
    broadcastStudentIds.length > 0 &&
    (broadcastDraft.trim().length > 0 || Boolean(broadcastAttachmentFile)) &&
    (!needsBroadcastDepartment || Boolean(broadcastDepartment));

  function selectStaffStudent(studentId: number) {
    const matches = studentConversations.filter((item) => item.other_user.id === studentId);
    const conversation = matches.sort((left, right) => {
      const leftAt = left.last_message_at ?? left.last_message?.created_at ?? '';
      const rightAt = right.last_message_at ?? right.last_message?.created_at ?? '';
      return rightAt.localeCompare(leftAt);
    })[0];

    setError(null);
    setSelectedStudentId(studentId);

    if (conversation) {
      setActiveId(conversation.id);
      return;
    }

    startStudentThread.mutate({ studentId });
  }

  function selectSuperAdminStudent(studentId: number) {
    const matches = studentConversations.filter((item) => item.other_user.id === studentId);
    const conversation = matches.sort((left, right) => {
      const leftAt = left.last_message_at ?? left.last_message?.created_at ?? '';
      const rightAt = right.last_message_at ?? right.last_message?.created_at ?? '';
      return rightAt.localeCompare(leftAt);
    })[0];

    setError(null);
    setSelectedStudentId(studentId);

    if (conversation) {
      setActiveId(conversation.id);
      return;
    }

    setActiveId(null);
  }

  function openSuperAdminDepartment(department: string) {
    if (!selectedStudentId) return;

    const existing = selectedStudentConversations.find((item) => item.department === department);
    setError(null);

    if (existing) {
      setActiveId(existing.id);
      return;
    }

    startStudentThread.mutate({ studentId: selectedStudentId, department });
  }

  function goBackInSuperAdminInbox() {
    setError(null);
    setDraft('');
    setActiveId(null);
    setSelectedStudentId(null);
    setInboxPanel('menu');
  }

  function goBackInStaffInbox() {
    setError(null);
    setDraft('');
    setActiveId(null);
    setSelectedStudentId(null);
    setInboxPanel('menu');
  }

  const threadTitle =
    activeConversation?.kind === 'staff_dm'
      ? (activeConversation.other_user?.staff_department_label ??
        activeConversation.other_user?.name ??
        'Team chat')
      : isAdminViewer
        ? activeConversation
          ? [
              activeConversation.other_user.name,
              activeConversation.department_label
                ? ` · ${activeConversation.department_label}`
                : '',
            ].join('')
          : selectedStudent
            ? `${selectedStudent.name} · Select a department`
            : 'Select a student'
        : isDepartmentStaff
          ? activeConversation
            ? activeConversation.other_user?.name
            : selectedStudent
              ? selectedStudent.name
              : 'Select a student'
          : isConsultant
            ? [
                activeConversation?.other_user?.name ?? 'Select a conversation',
                activeConversation?.department_label
                  ? `, ${activeConversation.department_label}`
                  : '',
              ].join('')
            : (activeConversation?.department_label ??
              pendingDepartmentMeta?.label ??
              activeConversation?.other_user?.name ??
              'Select a department');

  return (
    <AppShell
      badge={isConsultant ? (isAdminViewer ? 'Admin' : 'Team') : 'Student'}
      title="Messages">
      <div className="page-stack">
        <div className="chat-layout">
            <div className="chat-list">
              {isConsultant ? (
                <div className="chat-list-tabs" role="tablist" aria-label="Message lists">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={staffListTab === 'inbox'}
                    className={`chat-list-tab${staffListTab === 'inbox' ? ' active' : ''}`}
                    onClick={() => {
                      setStaffListTab('inbox');
                      setInboxPanel('menu');
                      setActiveId(null);
                      setSelectedStudentId(null);
                    }}>
                    {staffListTab !== 'inbox'
                      ? 'Home'
                      : inboxPanel === 'broadcast'
                        ? 'Broadcast'
                        : inboxPanel === 'students'
                          ? 'Students'
                          : 'Home'}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={staffListTab === 'team'}
                    className={`chat-list-tab${staffListTab === 'team' ? ' active' : ''}`}
                    onClick={() => {
                      setStaffListTab('team');
                      setSelectedStudentId(null);
                      setInboxPanel('menu');
                    }}>
                    Team
                    {teamUnread > 0 ? (
                      <span className="chat-list-tab-count">{teamUnread}</span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={staffListTab === 'blocked'}
                    className={`chat-list-tab${staffListTab === 'blocked' ? ' active' : ''}`}
                    onClick={() => {
                      setStaffListTab('blocked');
                      setActiveId(null);
                      setSelectedStudentId(null);
                      setInboxPanel('menu');
                    }}>
                    Blocked
                    {blockedStudents.length > 0 ? (
                      <span className="chat-list-tab-count">{blockedStudents.length}</span>
                    ) : null}
                  </button>
                </div>
              ) : null}

              {isConsultant && staffListTab === 'team' ? (
                <div className="chat-team-panel">
                  <div className="chat-team-section chat-staff-directory">
                    <p className="chat-team-label">Staff directory</p>
                    {staffDirectoryQuery.isLoading ? (
                      <InlinePageLoader message="Loading team…" />
                    ) : staffDirectory.length === 0 ? (
                      <p className="chat-team-empty">No other staff found.</p>
                    ) : (
                      <div className="chat-team-list">
                        {staffDirectory.map((member) => {
                          const selected =
                            member.id != null &&
                            activeConversation?.kind === 'staff_dm' &&
                            activeConversation.other_user.id === member.id;
                          const canSelect = Boolean(member.id) && member.available !== false;

                          return (
                            <button
                              key={member.staff_department ?? member.name}
                              type="button"
                              className={`chat-list-item chat-list-person chat-team-card${
                                selected ? ' active' : ''
                              }`}
                              disabled={!canSelect || startStaffChat.isPending}
                              onClick={() => {
                                if (!member.id) return;
                                startStaffChat.mutate(member.id);
                              }}>
                              <span className="chat-list-person-copy">
                                <span className="chat-list-item-top">
                                  <strong>{member.name}</strong>
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {isConsultant && staffListTab === 'blocked' ? (
                <div className="chat-team-panel">
                  {blocksQuery.isLoading ? (
                    <InlinePageLoader message="Loading blocked students…" />
                  ) : null}
                  {!blocksQuery.isLoading && blockedStudents.length === 0 ? (
                    <p className="chat-team-empty" style={{ margin: 14 }}>
                      No students are blocked.
                    </p>
                  ) : null}
                  <div className="chat-team-list">
                    {blockedStudents.map((block) => (
                      <div
                        key={block.student_id}
                        className="chat-list-item chat-list-person chat-team-card chat-blocked-row">
                        <span className="chat-list-person-copy">
                          <span className="chat-list-item-top">
                            <strong>{block.student.name ?? 'Student'}</strong>
                          </span>
                          <button
                            type="button"
                            className="chat-block-btn unblock"
                            disabled={unblockStudent.isPending}
                            onClick={() => {
                              const confirmed = window.confirm(
                                'Unblock this student so they can message all staff again?',
                              );
                              if (!confirmed) return;
                              unblockStudent.mutate(block.student_id);
                            }}>
                            Unblock
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {!isConsultant ? (
                <div className="dept-picker">
                  <p className="dept-picker-label">Departments</p>
                  {departmentsQuery.data?.map((department) => {
                    const conversation = conversations.find(
                      (item) => item.department === department.value,
                    );
                    const unread = conversation?.unread_count ?? 0;
                    return (
                      <button
                        key={department.value}
                        type="button"
                        className={`chat-list-item chat-team-card${
                          activeConversation?.department === department.value ||
                          pendingDepartment === department.value
                            ? ' active'
                            : ''
                        }`}
                        onClick={() => startChat.mutate(department.value)}>
                        <span className="chat-list-item-top">
                          <strong>{department.label}</strong>
                          {unread > 0 ? <span className="chat-unread-badge">{unread}</span> : null}
                        </span>
                      </button>
                    );
                  })}
                  {conversations
                    .filter((conversation) => !conversation.department)
                    .map((conversation) => (
                      <button
                        key={conversation.id}
                        type="button"
                        className={`chat-list-item chat-team-card${activeId === conversation.id ? ' active' : ''}`}
                        onClick={() => setActiveId(conversation.id)}>
                        <span className="chat-list-item-top">
                          <strong>{conversation.other_user.name ?? 'Previous chat'}</strong>
                          {(conversation.unread_count ?? 0) > 0 ? (
                            <span className="chat-unread-badge">{conversation.unread_count}</span>
                          ) : null}
                        </span>
                      </button>
                    ))}
                </div>
              ) : null}

              {isConsultant && staffListTab === 'inbox' ? (
                <>
                  {inboxPanel === 'menu' ? (
                    <div className="chat-menu">
                      <button type="button" className="chat-menu-card" onClick={openBroadcastPanel}>
                        <span className="chat-menu-icon" aria-hidden>
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                            <path
                              d="M4 7h16M4 12h10M4 17h13"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </span>
                        <span className="chat-menu-copy">
                          <strong>Broadcast</strong>
                          <span>Send one message to selected students</span>
                        </span>
                      </button>
                      <button type="button" className="chat-menu-card" onClick={openStudentsPanel}>
                        <span className="chat-menu-icon students" aria-hidden>
                          <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                            <path
                              d="M16 11a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3ZM8 14c-2.67 0-8 1.34-8 4v1h10v-1c0-1.1.45-2.1 1.2-2.9A11.3 11.3 0 0 0 8 14Zm8 0c-.4 0-.8.03-1.18.08A5.3 5.3 0 0 1 17 18v1h7v-1c0-2.66-5.33-4-8-4Z"
                              fill="currentColor"
                            />
                          </svg>
                        </span>
                        <span className="chat-menu-copy">
                          <strong>Students</strong>
                          <span>Open student conversations</span>
                        </span>
                        {studentConversations.reduce(
                          (sum, conversation) => sum + (conversation.unread_count ?? 0),
                          0,
                        ) > 0 ? (
                          <span className="chat-unread-badge">
                            {studentConversations.reduce(
                              (sum, conversation) => sum + (conversation.unread_count ?? 0),
                              0,
                            )}
                          </span>
                        ) : null}
                      </button>
                    </div>
                  ) : null}

                  {inboxPanel === 'broadcast' ? (
                    <button type="button" className="chat-list-back" onClick={goBackToInboxMenu}>
                      ← Back
                    </button>
                  ) : null}

                  {inboxPanel === 'students' && isAdminViewer ? (
                    <>
                      <button
                        type="button"
                        className="chat-list-back"
                        onClick={goBackInSuperAdminInbox}>
                        ← Back
                      </button>
                      <DirectoryList
                        framed={false}
                        title="Students"
                        items={inboxGroupedStudents.map((student) => ({
                          id: student.id,
                          title: student.name,
                          subtitle: student.email,
                          active: selectedStudentId === student.id,
                          onClick: () => selectSuperAdminStudent(student.id),
                          badge:
                            student.unreadCount > 0 ? (
                              <span className="chat-unread-badge">{student.unreadCount}</span>
                            ) : (
                              'Open'
                            ),
                        }))}
                        loading={
                          broadcastStudentsQuery.isLoading || conversationsQuery.isLoading
                        }
                        emptyTitle="No students yet"
                      />
                    </>
                  ) : null}

                  {inboxPanel === 'students' && isDepartmentStaff ? (
                    <>
                      <button type="button" className="chat-list-back" onClick={goBackInStaffInbox}>
                        ← Back
                      </button>
                      <DirectoryList
                        framed={false}
                        title="Students"
                        items={inboxGroupedStudents.map((student) => ({
                          id: student.id,
                          title: student.name,
                          subtitle: student.email,
                          active: selectedStudentId === student.id,
                          onClick: () => {
                            if (!startStudentThread.isPending) selectStaffStudent(student.id);
                          },
                          badge:
                            student.unreadCount > 0 ? (
                              <span className="chat-unread-badge">{student.unreadCount}</span>
                            ) : (
                              'Open'
                            ),
                        }))}
                        loading={
                          broadcastStudentsQuery.isLoading || conversationsQuery.isLoading
                        }
                        emptyTitle="No students yet"
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="chat-thread">
              {showBroadcast ? (
                <>
                  <div className="chat-thread-header chat-broadcast-header">
                    <div className="chat-thread-title-block">
                      <span>Broadcast to students</span>
                      {!needsBroadcastDepartment ? (
                        <small className="chat-broadcast-header-hint">
                          Sends to {user?.staff_department_label ?? 'your department'}
                        </small>
                      ) : null}
                    </div>
                    <div className="chat-thread-header-actions">
                      <div
                        ref={broadcastScheduleDropdownRef}
                        className={`chat-schedule-dropdown${showBroadcastScheduleMenu ? ' open' : ''}`}>
                        <button
                          type="button"
                          className={`chat-schedule-toggle${broadcastScheduleAt ? ' active' : ''}`}
                          onClick={() => setShowBroadcastScheduleMenu((value) => !value)}>
                          {broadcastScheduleAt ? 'Scheduled' : 'Schedule'}
                        </button>
                        {showBroadcastScheduleMenu ? (
                          <div className="chat-schedule-menu" role="dialog" aria-label="Schedule broadcast">
                            <label className="chat-schedule-field">
                              <span>Schedule send (optional)</span>
                              <input
                                type="datetime-local"
                                value={broadcastScheduleAt}
                                min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                                onChange={(event) => setBroadcastScheduleAt(event.target.value)}
                              />
                            </label>
                            {broadcastScheduleAt ? (
                              <button
                                type="button"
                                className="chat-attach-clear"
                                onClick={() => setBroadcastScheduleAt('')}>
                                Clear schedule
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className="chat-broadcast">
                    {needsBroadcastDepartment ? (
                      <label className="chat-broadcast-field">
                        <span>Department</span>
                        <select
                          value={broadcastDepartment}
                          onChange={(event) => setBroadcastDepartment(event.target.value)}>
                          <option value="">Select department</option>
                          {(departmentsQuery.data ?? []).map((department) => (
                            <option key={department.value} value={department.value}>
                              {department.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    <section className="chat-broadcast-recipients">
                      <div className="chat-broadcast-recipients-head">
                        <label className="chat-broadcast-field chat-broadcast-search-field">
                          <span>Students</span>
                          <input
                            value={broadcastSearch}
                            onChange={(event) => setBroadcastSearch(event.target.value)}
                            placeholder="Search by name or email"
                            autoComplete="off"
                          />
                        </label>
                        <div className="chat-broadcast-recipients-meta">
                          <span>
                            {broadcastStudentIds.length > 0
                              ? `${broadcastStudentIds.length} selected`
                              : `${filteredBroadcastStudents.length} listed`}
                          </span>
                          {filteredBroadcastStudents.length > 0 ? (
                            <button
                              type="button"
                              className="text-link-btn"
                              onClick={() => {
                                const visibleIds = filteredBroadcastStudents.map((item) => item.id);
                                const allSelected = visibleIds.every((id) =>
                                  broadcastStudentIds.includes(id),
                                );
                                setBroadcastStudentIds((current) =>
                                  allSelected
                                    ? current.filter((id) => !visibleIds.includes(id))
                                    : Array.from(new Set([...current, ...visibleIds])),
                                );
                              }}>
                              {filteredBroadcastStudents.every((item) =>
                                broadcastStudentIds.includes(item.id),
                              )
                                ? 'Clear visible'
                                : 'Select visible'}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="chat-broadcast-students">
                        {broadcastStudentsQuery.isLoading ? (
                          <InlinePageLoader message="Loading students…" />
                        ) : filteredBroadcastStudents.length === 0 ? (
                          <p className="chat-broadcast-empty">No students found.</p>
                        ) : (
                          filteredBroadcastStudents.map((student) => {
                            const selected = broadcastStudentIds.includes(student.id);
                            return (
                              <label
                                key={student.id}
                                className={`chat-broadcast-student${selected ? ' is-selected' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={selected}
                                  onChange={() => toggleBroadcastStudent(student.id)}
                                />
                                <span>
                                  <strong>{student.name}</strong>
                                  <span>{student.email}</span>
                                </span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    </section>

                    <label className="chat-broadcast-field">
                      <span>Message</span>
                      <textarea
                        value={broadcastDraft}
                        onChange={(event) => setBroadcastDraft(event.target.value)}
                        placeholder="Write one message for the selected students…"
                        rows={4}
                      />
                    </label>

                    <div className="chat-attach-row chat-broadcast-attach">
                      <input
                        ref={broadcastAttachmentInputRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.mp4,.mov,.webm,.m4v,.avi,application/pdf,image/*,video/*"
                        className="chat-attach-input"
                        onChange={(event) =>
                          setBroadcastAttachmentFile(event.target.files?.[0] ?? null)
                        }
                      />
                      <button
                        type="button"
                        className="ghost-btn btn-sm"
                        onClick={() => broadcastAttachmentInputRef.current?.click()}>
                        Attach file
                      </button>
                      {broadcastAttachmentFile ? (
                        <span className="chat-attach-name">
                          {broadcastAttachmentFile.name}
                          <button
                            type="button"
                            className="chat-attach-clear"
                            onClick={() => {
                              setBroadcastAttachmentFile(null);
                              if (broadcastAttachmentInputRef.current) {
                                broadcastAttachmentInputRef.current.value = '';
                              }
                            }}>
                            Remove
                          </button>
                        </span>
                      ) : (
                        <span className="chat-attach-hint">PDF, JPG, PNG, DOC, video · max 50 MB</span>
                      )}
                    </div>

                    <div className="chat-broadcast-actions">
                      <button
                        type="button"
                        className="primary-btn chat-broadcast-send"
                        disabled={
                          broadcastMessage.isPending ||
                          broadcastWhatsApp.isPending ||
                          broadcastStudentIds.length === 0 ||
                          (!broadcastDraft.trim() && !broadcastAttachmentFile) ||
                          (needsBroadcastDepartment && !broadcastDepartment)
                        }
                        onClick={() => broadcastMessage.mutate()}>
                        {broadcastMessage.isPending
                          ? 'Sending…'
                          : broadcastScheduleAt
                            ? 'Schedule broadcast'
                            : 'Send broadcast'}
                      </button>
                      <button
                        type="button"
                        className="chat-broadcast-whatsapp"
                        disabled={
                          !canBroadcastWhatsApp ||
                          broadcastMessage.isPending ||
                          broadcastWhatsApp.isPending
                        }
                        onClick={() => broadcastWhatsApp.mutate()}>
                        {broadcastWhatsApp.isPending ? 'Sending…' : 'Send on WhatsApp'}
                      </button>
                    </div>
                    {error ? <p className="form-error">{error}</p> : null}
                  </div>
                </>
              ) : (
                <>
              <div className="chat-thread-header">
                <div className="chat-thread-identity">
                  <div className="chat-thread-title-block">
                    <span>{threadTitle}</span>
                    {isConsultant && activeConversation?.other_user?.phone ? (
                      <small className="chat-thread-phone">
                        WhatsApp → {activeConversation.other_user.phone}
                      </small>
                    ) : isConsultant &&
                      activeConversation?.kind === 'student_department' &&
                      !activeConversation?.other_user?.phone ? (
                      <small className="chat-thread-phone warn">
                        No phone on Personal info — WhatsApp disabled
                      </small>
                    ) : null}
                  </div>
                </div>
                <div className="chat-thread-header-actions">
                  {isConsultant && activeId ? (
                    <div
                      ref={scheduleDropdownRef}
                      className={`chat-schedule-dropdown${showScheduleMenu ? ' open' : ''}`}>
                      <button
                        type="button"
                        className={`chat-schedule-toggle${scheduleAt ? ' active' : ''}`}
                        disabled={studentComposerLocked}
                        onClick={() => setShowScheduleMenu((value) => !value)}>
                        {scheduleAt ? 'Scheduled' : 'Schedule'}
                      </button>
                      {showScheduleMenu ? (
                        <div className="chat-schedule-menu" role="dialog" aria-label="Schedule message">
                          <label className="chat-schedule-field">
                            <span>Schedule send (optional)</span>
                            <input
                              type="datetime-local"
                              value={scheduleAt}
                              min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                              onChange={(event) => setScheduleAt(event.target.value)}
                            />
                          </label>
                          {scheduleAt ? (
                            <button
                              type="button"
                              className="chat-attach-clear"
                              onClick={() => setScheduleAt('')}>
                              Clear schedule
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {isConsultant && activeId && activeConversation?.kind !== 'staff_dm' ? (
                    <button
                      type="button"
                      className={`chat-block-btn${isBlocked ? ' unblock' : ''}`}
                      disabled={toggleBlock.isPending}
                      onClick={() => {
                        const confirmed = window.confirm(
                          isBlocked
                            ? 'Unblock this student so they can message all staff again?'
                            : 'Block this student from messaging all staff? They will not be able to chat with any department until unblocked.',
                        );
                        if (!confirmed) return;
                        toggleBlock.mutate(isBlocked);
                      }}>
                      {isBlocked ? 'Unblock chat' : 'Block chat'}
                    </button>
                  ) : null}
                </div>
              </div>
              {broadcastNotice ? (
                <p className="chat-broadcast-notice">{broadcastNotice}</p>
              ) : null}
              {isBlocked ? (
                <p className="chat-blocked-banner">
                  {isConsultant
                    ? 'This student is blocked from messaging all staff. You can still message them.'
                    : 'Staff blocked you from sending messages. You can still read past messages.'}
                </p>
              ) : null}
              <div className="chat-messages">
                {!activeId && !pendingDepartment && !(isAdminViewer && selectedStudentId) ? (
                  <div className="chat-messages-empty chat-messages-idle">
                    <strong>Select a conversation</strong>
                    Choose a student, teammate, or department from the left to start messaging.
                  </div>
                ) : null}
                {!activeId && isAdminViewer && selectedStudentId ? (
                  <div className="chat-thread-dept-picker">
                    <div className="chat-messages-empty chat-messages-idle">
                      <strong>Message {selectedStudent?.name ?? 'student'}</strong>
                      Choose which department thread to open.
                    </div>
                    <div className="chat-card-list chat-thread-dept-list">
                      {departmentsQuery.isLoading ? (
                        <InlinePageLoader message="Loading departments…" />
                      ) : null}
                      {departmentsQuery.data?.map((department) => {
                        const conversation = selectedStudentConversations.find(
                          (item) => item.department === department.value,
                        );
                        const unread = conversation?.unread_count ?? 0;
                        return (
                          <button
                            key={department.value}
                            type="button"
                            className="chat-list-item chat-team-card"
                            disabled={startStudentThread.isPending}
                            onClick={() => openSuperAdminDepartment(department.value)}>
                            <span className="chat-list-item-top">
                              <strong>{department.label}</strong>
                              {unread > 0 ? (
                                <span className="chat-unread-badge">{unread}</span>
                              ) : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                {activeId || pendingDepartment ? (
                  <>
                {(threadQuery.data?.messages ?? []).length === 0 && !threadQuery.isLoading ? (
                  <div className="chat-messages-empty">
                    <strong>No messages yet</strong>
                    Start the conversation with a short note or attachment.
                  </div>
                ) : null}
                {(threadQuery.data?.messages ?? []).map((message) => (
                  <div
                    key={message.id}
                    className={`bubble ${message.mine ? 'mine' : 'theirs'}`}>
                    {message.body ? <span className="bubble-body">{message.body}</span> : null}
                    {message.attachment ? (
                      <button
                        type="button"
                        className="chat-attachment-link"
                        onClick={() => void openChatAttachment(message.attachment!)}>
                        {message.attachment.name ?? 'Attachment'}
                      </button>
                    ) : null}
                    {message.created_at ? (
                      <span className="bubble-meta">
                        {new Date(message.created_at).toLocaleTimeString(undefined, {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    ) : null}
                  </div>
                ))}
                {threadQuery.data?.peer_typing ? (
                  <div className="bubble theirs typing-bubble" aria-live="polite">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                ) : null}
                  </>
                ) : null}
              </div>
              <form className="chat-composer" onSubmit={onSubmit}>
                <div className="chat-composer-main">
                  <input
                    ref={attachmentInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.mp4,.mov,.webm,.m4v,.avi,application/pdf,image/*,video/*"
                    className="chat-attach-input"
                    onChange={(event) => setAttachmentFile(event.target.files?.[0] ?? null)}
                  />
                  <button
                    type="button"
                    className="chat-attach-btn"
                    aria-label="Attach file"
                    title="Attach file"
                    disabled={!composerReady || studentComposerLocked}
                    onClick={() => attachmentInputRef.current?.click()}>
                    <svg className="chat-attach-icon" viewBox="0 0 24 24" aria-hidden fill="none">
                      <path
                        d="M16.5 6.5v8.25a4.5 4.5 0 1 1-9 0V6.75a3 3 0 0 1 6 0v7.5a1.5 1.5 0 1 1-3 0V7.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      studentComposerLocked
                        ? 'Chat is blocked'
                        : composerReady
                          ? 'Type a message…'
                          : staffListTab === 'team'
                            ? 'Select a teammate first'
                            : isSuperAdmin
                              ? 'Select a student and department first'
                              : isDepartmentStaff
                                ? 'Select a student first'
                                : 'Select a department first'
                    }
                    disabled={!composerReady || studentComposerLocked}
                  />
                  {isConsultant ? (
                    <button
                      type="button"
                      className="chat-whatsapp-btn"
                      aria-label={
                        sendWhatsApp.isPending ? 'Sending on WhatsApp' : 'Send on WhatsApp'
                      }
                      title={
                        scheduleAt
                          ? 'Clear schedule to use WhatsApp'
                          : activeConversation?.kind === 'student_department' &&
                              !activeConversation?.other_user?.phone
                            ? 'Student must add a phone number in Personal info first'
                            : 'Send text/file in chat and on WhatsApp'
                      }
                      disabled={!canSendWhatsApp || sendMessage.isPending || sendWhatsApp.isPending}
                      onClick={onSendWhatsApp}>
                      {sendWhatsApp.isPending ? (
                        <span className="chat-whatsapp-pending" aria-hidden>
                          …
                        </span>
                      ) : (
                        <svg
                          className="chat-whatsapp-icon"
                          viewBox="0 0 24 24"
                          aria-hidden
                          focusable="false">
                          <path
                            fill="currentColor"
                            d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"
                          />
                        </svg>
                      )}
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="chat-send-btn"
                    aria-label={
                      isConsultant && scheduleAt
                        ? 'Schedule message'
                        : sendMessage.isPending
                          ? 'Sending'
                          : 'Send message'
                    }
                    title={isConsultant && scheduleAt ? 'Schedule' : 'Send'}
                    disabled={
                      !composerReady ||
                      (!draft.trim() && !attachmentFile) ||
                      sendMessage.isPending ||
                      studentComposerLocked
                    }>
                    {sendMessage.isPending ? (
                      <span className="chat-send-pending" aria-hidden>
                        …
                      </span>
                    ) : (
                      <svg
                        className="chat-send-icon"
                        viewBox="0 0 24 24"
                        aria-hidden
                        focusable="false"
                        fill="none">
                        <path
                          d="M9 6.5 15.5 12 9 17.5"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>
                </div>
                {attachmentFile ? (
                  <div className="chat-attach-selected">
                    <span>{attachmentFile.name}</span>
                    <button
                      type="button"
                      className="chat-attach-clear"
                      onClick={() => {
                        setAttachmentFile(null);
                        if (attachmentInputRef.current) {
                          attachmentInputRef.current.value = '';
                        }
                      }}>
                      Remove
                    </button>
                  </div>
                ) : null}
              </form>
              {error ? (
                <p className="form-error" style={{ padding: '0 14px 12px' }}>
                  {error}
                </p>
              ) : null}
                </>
              )}
            </div>
          </div>
      </div>
    </AppShell>
  );
}
