import Constants from 'expo-constants';
import { StyleSheet, Text, View } from 'react-native';
import IconMark from '@/assets/logo/icon.svg';
import { colors, fontSizes, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/**
 * App brand lockup: the icon mark (SVG) + the "Tailor's Ledger" wordmark in the app's
 * Vollkorn title face, with the app version. Used as the Settings footer. The wordmark is
 * real text (not baked into the SVG) so it uses the loaded font and scales with text size.
 */
export function AppLogo() {
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <View style={styles.wrap}>
      <IconMark width={56} height={56} />
      <Text style={styles.word}>
        Tailor&#8217;s <Text style={styles.wordAlt}>Ledger</Text>
      </Text>
      <Text style={styles.version}>v{version}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  word: { fontFamily: fonts.title, fontSize: fontSizes.xl, color: colors.accent },
  wordAlt: { color: colors.accentInk },
  version: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.faint },
});
