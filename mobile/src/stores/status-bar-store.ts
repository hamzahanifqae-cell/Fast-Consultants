import { create } from 'zustand';

type StatusBarStyle = 'light' | 'dark';

type StatusBarState = {
  override: StatusBarStyle | null;
  setOverride: (style: StatusBarStyle | null) => void;
};

export const useStatusBarStore = create<StatusBarState>((set) => ({
  override: null,
  setOverride: (override) => set({ override }),
}));
