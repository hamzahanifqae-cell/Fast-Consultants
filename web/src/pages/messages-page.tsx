import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { InlinePageLoader } from '@/components/app-loader';
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
  id: number;
  name: string;
  email: string;
  staff_department: string | null;
  staff_department_label: string | null;
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
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [staffListTab, setStaffListTab] = useState<StaffListTab>('inbox');
  const [inboxPanel, setInboxPanel] = useState<InboxPanel>('menu');
  const [showTeamDirectory, setShowTeamDirectory] = useState(false);
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
      (isSuperAdmin && selectedStudentId !== null) ||
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
  const totalUnread = conversationsQuery.data?.unread_count ?? 0;
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
    enabled: isConsultant && showBroadcast,
    queryFn: async () => {
      const { data } = await api.get<{ data: BroadcastStudent[] }>('/consultant/students');
      return data.data;
    },
  });

  const blockedStudents = blocksQuery.data ?? [];
  const staffDirectory = staffDirectoryQuery.data ?? [];
  const broadcastStudents = broadcastStudentsQuery.data ?? [];
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
        isBlocked: boolean;
      }
    >();

    for (const conversation of studentConversations) {
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
          ? (conversation.last_message?.body ?? 'No messages yet')
          : (existing?.preview ?? 'No messages yet'),
        lastMessageAt: shouldReplace ? lastMessageAt : (existing?.lastMessageAt ?? null),
        isBlocked: Boolean(existing?.isBlocked || conversation.is_blocked),
      });
    }

    return Array.from(byStudentId.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [studentConversations, isDepartmentStaff, isSuperAdmin]);

  const inboxGroupedStudents = useMemo(
    () => groupedStudents.filter((student) => !student.isBlocked),
    [groupedStudents],
  );

  const inboxConversations = useMemo(
    () =>
      isConsultant
        ? studentConversations.filter((conversation) => !conversation.is_blocked)
        : conversations,
    [conversations, isConsultant, studentConversations],
  );

  const selectedStudent = useMemo(
    () => groupedStudents.find((student) => student.id === selectedStudentId) ?? null,
    [groupedStudents, selectedStudentId],
  );

  const selectedStudentConversations = useMemo(() => {
    if (!isSuperAdmin || !selectedStudentId) {
      return [];
    }

    return studentConversations.filter(
      (conversation) => conversation.other_user.id === selectedStudentId,
    );
  }, [studentConversations, isSuperAdmin, selectedStudentId]);

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
    if (threadQuery.isSuccess && activeId != null) {
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
    }
  }, [threadQuery.dataUpdatedAt, threadQuery.isSuccess, activeId, queryClient]);

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
      if (existing) return existing;

      const { data } = await api.post<{
        data: { conversation: ChatConversation };
      }>('/chat/conversations', { department });
      return data.data.conversation;
    },
    onSuccess: async (conversation) => {
      setError(null);
      setActiveId(conversation.id);
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
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
      setShowTeamDirectory(false);
      setStaffListTab('team');
      setSelectedStudentId(null);
      setActiveId(conversation.id);
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not start staff chat.')),
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
      }>(`/chat/conversations/${activeId}/messages`, formData);
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
      if (payload.scheduled) {
        setBroadcastNotice(
          `Message scheduled for ${payload.scheduled_at ? new Date(payload.scheduled_at).toLocaleString() : 'later'}.`,
        );
        setAwaitingScheduledSince(new Date().toISOString());
      }
      await queryClient.invalidateQueries({ queryKey: ['chat-messages', activeId] });
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
          whatsapp: { sent: boolean; mode: string };
        };
      }>(`/chat/conversations/${activeId}/whatsapp`, formData);
      return data.data;
    },
    onSuccess: async () => {
      setDraft('');
      setAttachmentFile(null);
      setScheduleAt('');
      setShowScheduleMenu(false);
      if (attachmentInputRef.current) {
        attachmentInputRef.current.value = '';
      }
      setError(null);
      setBroadcastNotice('Sent in chat and on WhatsApp.');
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
    if (!activeId || studentComposerLocked) return;
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
  const isBlocked = Boolean(activeConversation?.is_blocked);
  const studentComposerLocked = !isConsultant && isBlocked;
  const canSendWhatsApp =
    isConsultant &&
    Boolean(activeId) &&
    !studentComposerLocked &&
    !scheduleAt &&
    (draft.trim().length > 0 || Boolean(attachmentFile));

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

    if (!conversation) {
      return;
    }

    setError(null);
    setActiveId(conversation.id);
    setSelectedStudentId(studentId);
  }

  function selectSuperAdminStudent(studentId: number) {
    setError(null);
    setActiveId(null);
    setSelectedStudentId(studentId);
  }

  function openSuperAdminDepartment(department: string) {
    const existing = selectedStudentConversations.find((item) => item.department === department);
    if (!existing) {
      return;
    }

    setError(null);
    setActiveId(existing.id);
  }

  function goBackInSuperAdminInbox() {
    setError(null);
    setDraft('');

    if (activeId) {
      setActiveId(null);
      return;
    }

    if (selectedStudentId) {
      setSelectedStudentId(null);
      return;
    }

    setInboxPanel('menu');
  }

  function goBackInStaffInbox() {
    setError(null);
    setDraft('');
    if (activeId) {
      setActiveId(null);
      setSelectedStudentId(null);
      return;
    }
    setInboxPanel('menu');
  }

  const threadTitle =
    activeConversation?.kind === 'staff_dm'
      ? (activeConversation.other_user?.name ?? 'Team chat')
      : isSuperAdmin
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
            : 'Select a student'
          : isConsultant
            ? [
                activeConversation?.other_user?.name ?? 'Select a conversation',
                activeConversation?.department_label
                  ? `, ${activeConversation.department_label}`
                  : '',
              ].join('')
            : (activeConversation?.department_label ??
              activeConversation?.other_user?.name ??
              'Select a department');

  return (
    <AppShell
      badge={isConsultant ? (isAdminViewer ? 'Admin' : 'Team') : 'Student'}
      title="Messages">
      <div className="page-stack">
        {totalUnread > 0 ? (
          <div
            className="panel"
            style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0 }}>Unread messages</h2>
            </div>
            <span className="status-pill">{totalUnread}</span>
          </div>
        ) : null}

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
                      setShowTeamDirectory(false);
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
                      setShowTeamDirectory(false);
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
                      setShowTeamDirectory(false);
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
                <>
                  <button
                    type="button"
                    className="chat-list-item"
                    onClick={() => setShowTeamDirectory((value) => !value)}>
                    <span className="chat-list-item-top">
                      <strong>{showTeamDirectory ? 'Hide directory' : 'New message'}</strong>
                    </span>
                    <span className="chat-list-item-preview">Message a teammate</span>
                  </button>
                  {showTeamDirectory ? (
                    staffDirectoryQuery.isLoading ? (
                      <InlinePageLoader message="Loading team…" />
                    ) : staffDirectory.length === 0 ? (
                      <p className="empty" style={{ padding: 18 }}>
                        No other staff found.
                      </p>
                    ) : (
                      staffDirectory.map((member) => (
                        <button
                          key={member.id}
                          type="button"
                          className="chat-list-item"
                          disabled={startStaffChat.isPending}
                          onClick={() => startStaffChat.mutate(member.id)}>
                          <span className="chat-list-item-top">
                            <strong>{member.name}</strong>
                          </span>
                          <span className="chat-list-item-preview">
                            {[member.staff_department_label, member.email].filter(Boolean).join(' · ')}
                          </span>
                        </button>
                      ))
                    )
                  ) : null}
                  {!showTeamDirectory && staffDmConversations.length === 0 ? (
                    <p className="empty" style={{ padding: 18 }}>
                      No team conversations yet.
                    </p>
                  ) : null}
                  {!showTeamDirectory
                    ? staffDmConversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          className={`chat-list-item${activeId === conversation.id ? ' active' : ''}`}
                          onClick={() => {
                            setError(null);
                            setSelectedStudentId(null);
                            setActiveId(conversation.id);
                          }}>
                          <span className="chat-list-item-top">
                            <strong>{conversation.other_user.name ?? 'Staff'}</strong>
                            {(conversation.unread_count ?? 0) > 0 ? (
                              <span className="status-pill">{conversation.unread_count}</span>
                            ) : null}
                          </span>
                          <span className="chat-list-item-preview">
                            {conversation.other_user.staff_department_label
                              ? `${conversation.other_user.staff_department_label} · `
                              : ''}
                            {conversation.last_message?.body ?? 'No messages yet'}
                          </span>
                        </button>
                      ))
                    : null}
                </>
              ) : null}

              {isConsultant && staffListTab === 'blocked' ? (
                <>
                  {blocksQuery.isLoading ? (
                    <InlinePageLoader message="Loading blocked students…" />
                  ) : null}
                  {!blocksQuery.isLoading && blockedStudents.length === 0 ? (
                    <p className="empty" style={{ padding: 18 }}>
                      No students are blocked.
                    </p>
                  ) : null}
                  {blockedStudents.map((block) => (
                    <div key={block.student_id} className="chat-list-item chat-blocked-row">
                      <span className="chat-list-item-top">
                        <strong>{block.student.name ?? 'Student'}</strong>
                      </span>
                      <span className="chat-list-item-preview">
                        {block.student.email ?? 'No email'}
                        {block.blocked_by?.name ? `, by ${block.blocked_by.name}` : ''}
                        {block.blocked_at
                          ? `, ${new Date(block.blocked_at).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}`
                          : ''}
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
                    </div>
                  ))}
                </>
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
                        className={`chat-list-item${
                          activeConversation?.department === department.value ? ' active' : ''
                        }`}
                        onClick={() => startChat.mutate(department.value)}>
                        <span className="chat-list-item-top">
                          <strong>{department.label}</strong>
                          {unread > 0 ? <span className="chat-unread-badge">{unread}</span> : null}
                        </span>
                        <span className="chat-list-item-preview">
                          {conversation?.other_user_typing
                            ? 'typing…'
                            : (conversation?.last_message?.body ??
                              'Tap to message this department')}
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
                        className={`chat-list-item${activeId === conversation.id ? ' active' : ''}`}
                        onClick={() => setActiveId(conversation.id)}>
                        <span className="chat-list-item-top">
                          <strong>{conversation.other_user.name ?? 'Previous chat'}</strong>
                          {(conversation.unread_count ?? 0) > 0 ? (
                            <span className="chat-unread-badge">{conversation.unread_count}</span>
                          ) : null}
                        </span>
                        <span className="chat-list-item-preview">
                          {conversation.other_user_typing
                            ? 'typing…'
                            : (conversation.last_message?.body ?? 'No messages yet')}
                        </span>
                      </button>
                    ))}
                </div>
              ) : null}

              {isConsultant && staffListTab === 'inbox' ? (
                <>
                  {inboxPanel === 'menu' ? (
                    <>
                      <button type="button" className="chat-list-item" onClick={openBroadcastPanel}>
                        <span className="chat-list-item-top">
                          <strong>Broadcast</strong>
                        </span>
                        <span className="chat-list-item-preview">
                          Send one message to selected students
                        </span>
                      </button>
                      <button type="button" className="chat-list-item" onClick={openStudentsPanel}>
                        <span className="chat-list-item-top">
                          <strong>Students</strong>
                          {studentConversations.reduce(
                            (sum, conversation) => sum + (conversation.unread_count ?? 0),
                            0,
                          ) > 0 ? (
                            <span className="status-pill">
                              {studentConversations.reduce(
                                (sum, conversation) => sum + (conversation.unread_count ?? 0),
                                0,
                              )}
                            </span>
                          ) : null}
                        </span>
                        <span className="chat-list-item-preview">
                          Open student conversations
                        </span>
                      </button>
                    </>
                  ) : null}

                  {inboxPanel === 'broadcast' ? (
                    <button type="button" className="chat-list-back" onClick={goBackToInboxMenu}>
                      ← Back
                    </button>
                  ) : null}

                  {inboxPanel === 'students' && isSuperAdmin ? (
                    <>
                      <button
                        type="button"
                        className="chat-list-back"
                        onClick={goBackInSuperAdminInbox}>
                        {selectedStudentId
                          ? activeId
                            ? '← Departments'
                            : '← All students'
                          : '← Back'}
                      </button>
                      {!selectedStudentId ? (
                        <>
                          {conversationsQuery.isLoading ? (
                            <InlinePageLoader message="Loading students…" />
                          ) : null}
                          {!conversationsQuery.isLoading && !inboxGroupedStudents.length ? (
                            <p className="empty" style={{ padding: 18 }}>
                              No student messages yet.
                            </p>
                          ) : null}
                          {inboxGroupedStudents.map((student) => (
                            <button
                              key={student.id}
                              type="button"
                              className={`chat-list-item${
                                selectedStudentId === student.id ? ' active' : ''
                              }`}
                              onClick={() => selectSuperAdminStudent(student.id)}>
                              <span className="chat-list-item-top">
                                <strong>{student.name}</strong>
                                <span className="chat-list-item-meta">
                                  {student.unreadCount > 0 ? (
                                    <span className="chat-unread-badge">{student.unreadCount}</span>
                                  ) : null}
                                </span>
                              </span>
                              <span className="chat-list-item-preview">
                                {student.email}, {student.preview}
                              </span>
                            </button>
                          ))}
                        </>
                      ) : (
                        <>
                          <p className="dept-picker-label">
                            Departments for {selectedStudent?.name ?? 'student'}
                          </p>
                          {departmentsQuery.data?.map((department) => {
                            const conversation = selectedStudentConversations.find(
                              (item) => item.department === department.value,
                            );
                            const unread = conversation?.unread_count ?? 0;
                            return (
                              <button
                                key={department.value}
                                type="button"
                                className={`chat-list-item${
                                  activeId === conversation?.id ? ' active' : ''
                                }`}
                                disabled={!conversation}
                                onClick={() => openSuperAdminDepartment(department.value)}>
                                <span className="chat-list-item-top">
                                  <strong>{department.label}</strong>
                                  {unread > 0 ? (
                                    <span className="chat-unread-badge">{unread}</span>
                                  ) : null}
                                </span>
                                <span className="chat-list-item-preview">
                                  {conversation?.other_user_typing
                                    ? 'typing…'
                                    : (conversation?.last_message?.body ?? 'No conversation yet')}
                                </span>
                              </button>
                            );
                          })}
                        </>
                      )}
                    </>
                  ) : null}

                  {inboxPanel === 'students' && isDepartmentStaff ? (
                    <>
                      <button type="button" className="chat-list-back" onClick={goBackInStaffInbox}>
                        {activeId ? '← All students' : '← Back'}
                      </button>
                      {conversationsQuery.isLoading ? (
                        <InlinePageLoader message="Loading students…" />
                      ) : null}
                      {!conversationsQuery.isLoading && !inboxGroupedStudents.length ? (
                        <p className="empty" style={{ padding: 18 }}>
                          No student messages for your department yet.
                        </p>
                      ) : null}
                      {inboxGroupedStudents.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          className={`chat-list-item${
                            activeId && selectedStudentId === student.id ? ' active' : ''
                          }`}
                          onClick={() => selectStaffStudent(student.id)}>
                          <span className="chat-list-item-top">
                            <strong>{student.name}</strong>
                            <span className="chat-list-item-meta">
                              {student.unreadCount > 0 ? (
                                <span className="chat-unread-badge">{student.unreadCount}</span>
                              ) : null}
                            </span>
                          </span>
                          <span className="chat-list-item-preview">
                            {student.email}, {student.preview}
                          </span>
                        </button>
                      ))}
                    </>
                  ) : null}

                  {inboxPanel === 'students' && !isSuperAdmin && isAdminViewer ? (
                    <>
                      <button
                        type="button"
                        className="chat-list-back"
                        onClick={() => {
                          if (activeId) {
                            setActiveId(null);
                            return;
                          }
                          goBackToInboxMenu();
                        }}>
                        {activeId ? '← All students' : '← Back'}
                      </button>
                      {conversationsQuery.isLoading ? (
                        <InlinePageLoader message="Loading conversations…" />
                      ) : null}
                      {!conversationsQuery.isLoading && !inboxConversations.length ? (
                        <p className="empty" style={{ padding: 18 }}>
                          No student messages yet.
                        </p>
                      ) : null}
                      {inboxConversations.map((conversation) => (
                        <button
                          key={conversation.id}
                          type="button"
                          className={`chat-list-item${activeId === conversation.id ? ' active' : ''}`}
                          onClick={() => setActiveId(conversation.id)}>
                          <span className="chat-list-item-top">
                            <strong>{conversation.other_user.name}</strong>
                            <span className="chat-list-item-meta">
                              {(conversation.unread_count ?? 0) > 0 ? (
                                <span className="chat-unread-badge">{conversation.unread_count}</span>
                              ) : null}
                            </span>
                          </span>
                          <span className="chat-list-item-preview">
                            {conversation.department_label
                              ? `${conversation.department_label}, `
                              : ''}
                            {conversation.other_user_typing
                              ? 'typing…'
                              : (conversation.last_message?.body ?? 'No messages yet')}
                          </span>
                        </button>
                      ))}
                    </>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="chat-thread">
              {showBroadcast ? (
                <>
                  <div className="chat-thread-header">
                    <span>Broadcast to students</span>
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
                    ) : (
                      <p className="chat-broadcast-hint">
                        Sends to your department
                        {user?.staff_department_label ? ` (${user.staff_department_label})` : ''}.
                      </p>
                    )}
                    <label className="chat-broadcast-field">
                      <span>Search students</span>
                      <input
                        value={broadcastSearch}
                        onChange={(event) => setBroadcastSearch(event.target.value)}
                        placeholder="Name or email"
                      />
                    </label>
                    <div className="chat-broadcast-students">
                      {broadcastStudentsQuery.isLoading ? (
                        <InlinePageLoader message="Loading students…" />
                      ) : filteredBroadcastStudents.length === 0 ? (
                        <p className="empty">No students found.</p>
                      ) : (
                        filteredBroadcastStudents.map((student) => {
                          const selected = broadcastStudentIds.includes(student.id);
                          return (
                            <label key={student.id} className="chat-broadcast-student">
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
                    <label className="chat-broadcast-field">
                      <span>
                        Message
                        {broadcastStudentIds.length > 0
                          ? ` · ${broadcastStudentIds.length} selected`
                          : ''}
                      </span>
                      <textarea
                        value={broadcastDraft}
                        onChange={(event) => setBroadcastDraft(event.target.value)}
                        placeholder="Write one message for the selected students…"
                        rows={4}
                      />
                    </label>
                    <div className="chat-attach-row">
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
                        className="chat-attach-btn"
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
                      <button
                        type="button"
                        className="chat-broadcast-send"
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
                        className="chat-whatsapp-btn chat-broadcast-whatsapp"
                        disabled={
                          !canBroadcastWhatsApp ||
                          broadcastMessage.isPending ||
                          broadcastWhatsApp.isPending
                        }
                        onClick={() => broadcastWhatsApp.mutate()}>
                        {broadcastWhatsApp.isPending ? 'Sending…' : 'WhatsApp'}
                      </button>
                    {error ? <p className="form-error">{error}</p> : null}
                  </div>
                </>
              ) : (
                <>
              <div className="chat-thread-header">
                <span>{threadTitle}</span>
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
                {(threadQuery.data?.messages ?? []).map((message) => (
                  <div
                    key={message.id}
                    className={`bubble ${message.mine ? 'mine' : 'theirs'}`}>
                    {message.body ? <span>{message.body}</span> : null}
                    {message.attachment ? (
                      <button
                        type="button"
                        className="chat-attachment-link"
                        onClick={() => void openChatAttachment(message.attachment!)}>
                        {message.attachment.name ?? 'Attachment'}
                      </button>
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
                    disabled={!activeId || studentComposerLocked}
                    onClick={() => attachmentInputRef.current?.click()}>
                    Attach
                  </button>
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={
                      studentComposerLocked
                        ? 'Chat is blocked'
                        : activeId
                          ? 'Type a message…'
                          : staffListTab === 'team'
                            ? 'Select a teammate first'
                            : isSuperAdmin
                              ? 'Select a student and department first'
                              : isDepartmentStaff
                                ? 'Select a student first'
                                : 'Select a department first'
                    }
                    disabled={!activeId || studentComposerLocked}
                  />
                  {isConsultant ? (
                    <button
                      type="button"
                      className="chat-whatsapp-btn"
                      title={
                        scheduleAt
                          ? 'Clear schedule to use WhatsApp'
                          : 'Send text/file in chat and on WhatsApp'
                      }
                      disabled={!canSendWhatsApp || sendMessage.isPending || sendWhatsApp.isPending}
                      onClick={onSendWhatsApp}>
                      {sendWhatsApp.isPending ? 'Sending…' : 'WhatsApp'}
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={
                      !activeId ||
                      (!draft.trim() && !attachmentFile) ||
                      sendMessage.isPending ||
                      studentComposerLocked
                    }>
                    {isConsultant && scheduleAt ? 'Schedule' : 'Send'}
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
