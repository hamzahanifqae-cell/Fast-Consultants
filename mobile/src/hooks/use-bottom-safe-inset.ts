import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Bottom inset that clears the Android system navigation bar.
 * Edge-to-edge release builds often report insets.bottom as 0 even though
 * the 3-button / gesture nav bar still overlays content (Expo Go usually does not).
 */
export function useBottomSafeInset(minimum = 16) {
  const insets = useSafeAreaInsets();
  // Three-button nav is typically ~48dp; keep a floor so release APKs
  // never sit CTAs under the system bar when insets.bottom reports 0.
  const androidNavFloor = Platform.OS === 'android' ? 52 : 0;
  return Math.max(insets.bottom, androidNavFloor, minimum);
}
