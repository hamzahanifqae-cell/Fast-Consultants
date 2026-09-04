import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

/**
 * How much of the React Native window is covered by the keyboard.
 * Uses screenY overlap (more accurate on Android) with height as a fallback.
 */
export function useKeyboardBottomInset() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const measure = (screenY: number, reportedHeight: number) => {
      const windowHeight = Dimensions.get('window').height;
      const overlap = Math.ceil(windowHeight - screenY);
      return Math.max(overlap, Math.ceil(reportedHeight), 0);
    };

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setHeight(measure(event.endCoordinates.screenY, event.endCoordinates.height));
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return height;
}
