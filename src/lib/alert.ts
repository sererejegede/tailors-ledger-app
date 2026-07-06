/**
 * Cross-platform Alert. On native this is simply React Native's Alert. The web build
 * (alert.web.ts) swaps in a shim, because react-native-web's Alert.alert is a no-op (an
 * empty function) — which otherwise makes every confirm/notice in the app silently do
 * nothing in the browser. Import Alert from here instead of from 'react-native' so the same
 * call sites work on both platforms.
 */
export { Alert } from 'react-native';
