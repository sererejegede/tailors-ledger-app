import { StyleSheet, Text } from 'react-native';
import { colors, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/** A small capitalised heading above a group of settings rows. */
export function SettingsHeading({ title }: { title: string }) {
  return <Text style={styles.heading}>{title.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  heading: {
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.sm,
    fontFamily: fonts.bold,
    fontSize: fontSizes.sm,
    letterSpacing: 1,
    color: colors.text,
  },
});
