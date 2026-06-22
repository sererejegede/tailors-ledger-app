import { Platform, TextStyle } from 'react-native';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Vollkorn_600SemiBold, Vollkorn_700Bold } from '@expo-google-fonts/vollkorn';

/**
 * Type system. Plus Jakarta Sans for body/UI, Vollkorn for titles (build-plan Phase 3).
 * Measurement values get a tabular, monospaced treatment so digits line up like a
 * paper card. Fonts load at startup via useAppFonts().
 */
export const fonts = {
  body: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  title: 'Vollkorn_700Bold',
  titleSemi: 'Vollkorn_600SemiBold',
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })!,
} as const;

/** Tabular-mono style for measurement values (digits align column-wise). */
export const valueText: TextStyle = {
  fontFamily: fonts.mono,
  fontVariant: ['tabular-nums'],
};

/** Load the brand fonts. Returns true once ready. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Vollkorn_600SemiBold,
    Vollkorn_700Bold,
  });
  return loaded;
}
