import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { InlinePageLoader } from '@/components/app-loader';
import { AppShell } from '@/components/shell';
import { api, getApiErrorMessage } from '@/lib/api';
import { isSuperAdminUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import type { ChatConversation } from '@/types/auth';
import './dashboard.css';

type ChatMessage = {
  id: number;
  body: string;
  mine: boolean;
  sender: { id: number; name: string };
  created_at: string | null;
};

type ChatDepartment = {
  value: string;
  label: string;
};

type MessagesPageProps = {
  isConsultant: boolean;
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

  const departmentsQuery = useQuery({
    queryKey: ['chat-departments'],
    enabled: !isConsultant || (isSuperAdmin && selectedStudentId !== null),
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
          ? (conversation.last_message?.body ?? 'No messages yet')
          : (existing?.preview ?? 'No messages yet'),
        lastMessageAt: shouldReplace ? lastMessageAt : (existing?.lastMessageAt ?? null),
      });
    }

    return Array.from(byStudentId.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [conversations, isDepartmentStaff, isSuperAdmin]);

  const selectedStudent = useMemo(
    () => groupedStudents.find((student) => student.id === selectedStudentId) ?? null,
    [groupedStudents, selectedStudentId],
  );

  const selectedStudentConversations = useMemo(() => {
    if (!isSuperAdmin || !selectedStudentId) {
      return [];
    }

    return conversations.filter((conversation) => conversation.other_user.id === selectedStudentId);
  }, [conversations, isSuperAdmin, selectedStudentId]);

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
      const existing = conversations.find((item) => item.department === department);
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

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      const { data } = await api.post(`/chat/conversations/${activeId}/messages`, { body });
      return data;
    },
    onSuccess: async () => {
      setDraft('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['chat-messages', activeId] });
      await queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err) => setError(getApiErrorMessage(err, 'Could not send message.')),
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
    onError: (err) => setError(getApiErrorMessage(err, 'Could not update chat block.')),
  });

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
    if (!draft.trim() || !activeId) return;
    sendMessage.mutate(draft.trim());
  }

  const activeConversation =
    threadQuery.data?.conversation ??
    conversations.find((conversation) => conversation.id === activeId);
  const isBlocked = Boolean(activeConversation?.is_blocked);
  const studentComposerLocked = !isConsultant && isBlocked;

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

    setSelectedStudentId(null);
  }

  function goBackInStaffInbox() {
    setError(null);
    setDraft('');
    setActiveId(null);
    setSelectedStudentId(null);
  }

  const threadTitle = isSuperAdmin
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

              {isSuperAdmin ? (
                <>
                  {selectedStudentId ? (
                    <button
                      type="button"
                      className="chat-list-back"
                      onClick={goBackInSuperAdminInbox}>
                      {activeId ? '← Departments' : '← All students'}
                    </button>
                  ) : null}
                  {!selectedStudentId ? (
                    <>
                      {conversationsQuery.isLoading ? (
                        <InlinePageLoader message="Loading students…" />
                      ) : null}
                      {!conversationsQuery.isLoading && !groupedStudents.length ? (
                        <p className="empty" style={{ padding: 18 }}>
                          No student messages yet.
                        </p>
                      ) : null}
                      {groupedStudents.map((student) => (
                        <button
                          key={student.id}
                          type="button"
                          className={`chat-list-item${
                            selectedStudentId === student.id ? ' active' : ''
                          }`}
                          onClick={() => selectSuperAdminStudent(student.id)}>
                          <span className="chat-list-item-top">
                            <strong>{student.name}</strong>
                            {student.unreadCount > 0 ? (
                              <span className="chat-unread-badge">{student.unreadCount}</span>
                            ) : null}
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

              {isDepartmentStaff ? (
                <>
                  {activeId ? (
                    <button type="button" className="chat-list-back" onClick={goBackInStaffInbox}>
                      ← All students
                    </button>
                  ) : null}
                  {conversationsQuery.isLoading ? (
                    <InlinePageLoader message="Loading students…" />
                  ) : null}
                  {!conversationsQuery.isLoading && !groupedStudents.length ? (
                    <p className="empty" style={{ padding: 18 }}>
                      No student messages for your department yet.
                    </p>
                  ) : null}
                  {groupedStudents.map((student) => (
                    <button
                      key={student.id}
                      type="button"
                      className={`chat-list-item${activeId && selectedStudentId === student.id ? ' active' : ''}`}
                      onClick={() => selectStaffStudent(student.id)}>
                      <span className="chat-list-item-top">
                        <strong>{student.name}</strong>
                        {student.unreadCount > 0 ? (
                          <span className="chat-unread-badge">{student.unreadCount}</span>
                        ) : null}
                      </span>
                      <span className="chat-list-item-preview">
                        {student.email}, {student.preview}
                      </span>
                    </button>
                  ))}
                </>
              ) : null}

              {isConsultant && !isSuperAdmin && isAdminViewer ? (
                <>
                  {conversationsQuery.isLoading ? (
                    <InlinePageLoader message="Loading conversations…" />
                  ) : null}
                  {!conversationsQuery.isLoading && !conversations.length ? (
                    <p className="empty" style={{ padding: 18 }}>
                      {isAdminViewer
                        ? 'No student messages yet.'
                        : 'No student messages for your department yet.'}
                    </p>
                  ) : null}
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      className={`chat-list-item${activeId === conversation.id ? ' active' : ''}`}
                      onClick={() => setActiveId(conversation.id)}>
                      <span className="chat-list-item-top">
                        <strong>{conversation.other_user.name}</strong>
                        <span className="chat-list-item-meta">
                          {conversation.is_blocked ? (
                            <span className="chat-blocked-pill">Blocked</span>
                          ) : null}
                          {(conversation.unread_count ?? 0) > 0 ? (
                            <span className="chat-unread-badge">{conversation.unread_count}</span>
                          ) : null}
                        </span>
                      </span>
                      <span className="chat-list-item-preview">
                        {conversation.department_label ? `${conversation.department_label}, ` : ''}
                        {conversation.other_user_typing
                          ? 'typing…'
                          : (conversation.last_message?.body ?? 'No messages yet')}
                      </span>
                    </button>
                  ))}
                </>
              ) : null}
            </div>

            <div className="chat-thread">
              <div className="chat-thread-header">
                <span>{threadTitle}</span>
                {isConsultant && activeId ? (
                  <button
                    type="button"
                    className={`chat-block-btn${isBlocked ? ' unblock' : ''}`}
                    disabled={toggleBlock.isPending}
                    onClick={() => {
                      const confirmed = window.confirm(
                        isBlocked
                          ? 'Unblock this student so they can message again?'
                          : 'Block this student from sending chat messages?',
                      );
                      if (!confirmed) return;
                      toggleBlock.mutate(isBlocked);
                    }}>
                    {isBlocked ? 'Unblock chat' : 'Block chat'}
                  </button>
                ) : null}
              </div>
              {isBlocked ? (
                <p className="chat-blocked-banner">
                  {isConsultant
                    ? 'This student is blocked from sending messages. You can still message them.'
                    : 'Chat is blocked by staff. You can still read past messages.'}
                </p>
              ) : null}
              <div className="chat-messages">
                {(threadQuery.data?.messages ?? []).map((message) => (
                  <div
                    key={message.id}
                    className={`bubble ${message.mine ? 'mine' : 'theirs'}`}>
                    {message.body}
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
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    studentComposerLocked
                      ? 'Chat is blocked'
                      : activeId
                        ? 'Type a message…'
                        : isSuperAdmin
                          ? 'Select a student and department first'
                          : isDepartmentStaff
                            ? 'Select a student first'
                            : 'Select a department first'
                  }
                  disabled={!activeId || studentComposerLocked}
                />
                <button
                  type="submit"
                  disabled={
                    !activeId || !draft.trim() || sendMessage.isPending || studentComposerLocked
                  }>
                  Send
                </button>
              </form>
              {error ? (
                <p className="form-error" style={{ padding: '0 14px 12px' }}>
                  {error}
                </p>
              ) : null}
            </div>
          </div>
      </div>
    </AppShell>
  );
}
