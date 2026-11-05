import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * The keyboard's height while it's up, else 0. A form screen pads its bottom by this, so
 * its scroll area shrinks and the field being typed in stays in view (edge-to-edge
 * Android doesn't resize the window for the keyboard).
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
