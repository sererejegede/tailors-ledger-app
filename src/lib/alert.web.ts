/**
 * Web shim for React Native's Alert. react-native-web ships `Alert.alert` as an empty
 * no-op, so confirms and notices silently do nothing in the browser. This maps the RN Alert
 * API onto the browser's `window.alert` / `window.confirm`:
 *
 *  - 0–1 buttons  → window.alert (a notice), then fire that button's onPress.
 *  - 2+ buttons   → window.confirm; OK fires the primary (last non-cancel) action's onPress,
 *                   Cancel fires the cancel button's onPress.
 *
 * A 3-way chooser (e.g. camera/gallery/cancel) can't be expressed by window.confirm — those
 * call sites keep a custom Modal on web and only route to the real Alert on native.
 */

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text?: string;
  onPress?: (value?: string) => void;
  style?: AlertButtonStyle;
}

function alert(title: string, message?: string, buttons?: AlertButton[]): void {
  const body = [title, message].filter(Boolean).join('\n\n');
  const list = buttons ?? [];

  if (list.length <= 1) {
    window.alert(body);
    list[0]?.onPress?.();
    return;
  }

  const cancel = list.find((b) => b.style === 'cancel');
  const actions = list.filter((b) => b.style !== 'cancel');
  const primary = actions[actions.length - 1] ?? list[list.length - 1];

  if (window.confirm(body)) primary?.onPress?.();
  else cancel?.onPress?.();
}

export const Alert = { alert };
