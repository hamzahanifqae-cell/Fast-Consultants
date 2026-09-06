import { useMemo } from 'react';
import { Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Reliable top clearance for auth chrome (Android safe-area often reports 0). */
export function useAuthTopInset() {
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    const androidBar = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
    return Math.max(insets.top, androidBar, Platform.OS === 'android' ? 40 : 0);
  }, [insets.top]);
}
