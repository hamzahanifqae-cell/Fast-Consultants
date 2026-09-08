import { useEffect, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

/**
 * Distance from the top of the keyboard to the bottom of the screen.
 * Used with Android windowSoftInputMode=adjustNothing so we lift UI in JS.
 */
export function useKeyboardBottomInset() {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const measure = (screenY: number, reportedHeight: number) => {
      const screenHeight = Dimensions.get('screen').height;
      const fromScreen = Math.max(0, Math.ceil(screenHeight - screenY));
      const reported = Math.max(0, Math.ceil(reportedHeight));
      // fromScreen is the true covered strip when the IME overlays the window.
      return fromScreen > 0 ? fromScreen : reported;
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
