import { StyleSheet, View } from 'react-native';

import { ChatFab } from '@/components/chat-fab';
import { ChatPanel } from '@/components/chat-panel';
import { isOrganizationUser } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';
import { useChatUiStore } from '@/stores/chat-ui-store';

export function GlobalChatHost() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const visible = useChatUiStore((state) => state.visible);
  const conversationId = useChatUiStore((state) => state.conversationId);
  const open = useChatUiStore((state) => state.open);
  const close = useChatUiStore((state) => state.close);

  if (!token || !user) {
    return null;
  }

  const isConsultant = isOrganizationUser(user);

  return (
    <View pointerEvents="box-none" style={styles.host}>
      {!visible ? <ChatFab onPress={() => open()} /> : null}
      <ChatPanel
        isConsultant={isConsultant}
        initialConversationId={conversationId}
        onClose={close}
        visible={visible}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
});
