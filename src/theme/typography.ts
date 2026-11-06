import { Platform, TextStyle } from 'react-native';
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_400Regular_Italic,
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
  italic: 'PlusJakartaSans_400Regular_Italic',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  title: 'Vollkorn_700Bold',
  titleSemi: 'Vollkorn_600SemiBold',
  // On the web, Android's monospace fonts have no ₦, so the browser is pointed at a
  // sans-serif for it. Native text finds a fallback for the ₦ on its own.
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Menlo, Consolas, monospace, sans-serif' })!,
} as const;

/** Tabular-mono style for measurement values (digits align column-wise). */
export const valueText: TextStyle = {
  fontFamily: fonts.mono,
  fontVariant: ['tabular-nums'],
};

/**
 * A label centred in a button. Plus Jakarta Sans has more room above its letters than below,
 * so it sits about 0.05em low in its line, and Android pads text with the font's taller
 * outer metrics on top of that. This drops the padding and lifts the label to match.
 */
export function buttonLabel(fontSize: number): TextStyle {
  return {
    fontSize,
    includeFontPadding: false,
    // Half-pixel steps: 0.5px at 14, 1px at 16 to 24.
    transform: [{ translateY: -Math.round(fontSize * 0.1) / 2 }],
  };
}

/** Load the brand fonts. Returns true once ready. */
export function useAppFonts(): boolean {
  const [loaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_400Regular_Italic,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    Vollkorn_600SemiBold,
    Vollkorn_700Bold,
  });
  return loaded;
}
