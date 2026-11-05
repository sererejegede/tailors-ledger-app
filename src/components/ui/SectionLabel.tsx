import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';

type Props = {
  title: string;
  /** Shown at the right, e.g. a count or "₦95,000 owed". */
  aside?: string;
  /** Draw `aside` in the money/number font. */
  asideIsNumber?: boolean;
};

/** A section's small uppercase label ("THIS WEEK", "MEASUREMENT SETS  2"). */
export function SectionLabel({ title, aside, asideIsNumber }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="header">
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {aside ? <Text style={[styles.aside, asideIsNumber && styles.number]}>{aside}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: space.lg + space.xs,
    marginBottom: space.xs,
  },
  title: { fontFamily: fonts.bold, fontSize: fontSizes.xs, letterSpacing: 1, color: colors.muted },
  aside: { fontFamily: fonts.semibold, fontSize: fontSizes.xs, color: colors.muted },
  number: { ...valueText, color: colors.text },
});
