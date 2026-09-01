import { ChatPanel } from '@/components/chat-panel';
import { useAuthStore } from '@/stores/auth-store';
import { useChatUiStore } from '@/stores/chat-ui-store';
import { isOrganizationUser } from '@/lib/roles';

export function GlobalChatHost() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const visible = useChatUiStore((state) => state.visible);
  const conversationId = useChatUiStore((state) => state.conversationId);
  const close = useChatUiStore((state) => state.close);

  if (!token || !user) {
    return null;
  }

  const isConsultant = isOrganizationUser(user);

  return (
    <ChatPanel
      isConsultant={isConsultant}
      initialConversationId={conversationId}
      onClose={close}
      visible={visible}
    />
  );
}
