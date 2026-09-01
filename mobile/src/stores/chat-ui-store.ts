import { create } from 'zustand';

type ChatUiState = {
  visible: boolean;
  conversationId: number | null;
  open: (conversationId?: number | null) => void;
  close: () => void;
};

export const useChatUiStore = create<ChatUiState>((set) => ({
  visible: false,
  conversationId: null,
  open: (conversationId = null) =>
    set({
      visible: true,
      conversationId: conversationId ?? null,
    }),
  close: () =>
    set({
      visible: false,
      conversationId: null,
    }),
}));
