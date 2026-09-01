import { create } from 'zustand';

type SaveFeedbackState = {
  message: string | null;
  visible: boolean;
  show: (message: string) => void;
  hide: () => void;
};

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useSaveFeedbackStore = create<SaveFeedbackState>((set) => ({
  message: null,
  visible: false,
  show: (message) => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ message, visible: true });
    hideTimer = setTimeout(() => {
      set({ visible: false, message: null });
    }, 4500);
  },
  hide: () => {
    if (hideTimer) clearTimeout(hideTimer);
    set({ visible: false, message: null });
  },
}));

export function showSaveFeedback(message: string): void {
  useSaveFeedbackStore.getState().show(message);
}
