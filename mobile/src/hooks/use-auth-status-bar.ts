import { useEffect } from 'react';

import { useStatusBarStore } from '@/stores/status-bar-store';

/** Auth screens sit on a dark gradient — force light (white) status icons. */
export function useAuthStatusBar() {
  const setOverride = useStatusBarStore((state) => state.setOverride);

  useEffect(() => {
    setOverride('light');
    return () => setOverride(null);
  }, [setOverride]);
}
