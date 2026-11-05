import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import ChevronIcon from '@/assets/icons/chevron-right.svg';
import CheckIcon from '@/assets/icons/check.svg';

type LinkRowProps = {
  title: string;
  /** Grey, at the right: "GTBank ··· 6789". */
  value?: string;
  onPress: () => void;
  /** The last row of a group has no line under it. */
  last?: boolean;
};

/** A settings row that opens something: the name, a grey value and a chevron. */
export function LinkRow({ title, value, onPress, last }: LinkRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, last && styles.last, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}, ${value}` : title}
    >
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {value ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <ChevronIcon width={18} height={18} color={colors.faint} />
    </Pressable>
  );
}

type SwitchRowProps = {
  title: string;
  value: boolean;
  onChange: (next: boolean) => void;
  last?: boolean;
};

/** A row with an on/off switch at the right. The whole row toggles it. */
export function SwitchRow({ title, value, onChange, last }: SwitchRowProps) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={({ pressed }) => [styles.row, last && styles.last, pressed && styles.pressed]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={title}
    >
      <Text style={styles.title}>{title}</Text>
      <Toggle on={value} />
    </Pressable>
  );
}

/** The switch itself: maroon when on. */
export function Toggle({ on }: { on: boolean }) {
  return (
    <View style={[styles.track, on && styles.trackOn]}>
      <View style={[styles.thumb, on && styles.thumbOn]} />
    </View>
  );
}

type CheckRowProps = {
  title: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  last?: boolean;
};

/** A row with a checkbox at the left ("Use as default?"). The whole row ticks it. */
export function CheckRow({ title, checked, onChange, last }: CheckRowProps) {
  return (
    <Pressable
      onPress={() => onChange(!checked)}
      style={({ pressed }) => [styles.row, last && styles.last, pressed && styles.pressed]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={title}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <CheckIcon width={16} height={16} color={colors.surface} /> : null}
      </View>
      <Text style={styles.title}>{title}</Text>
    </Pressable>
  );
}

/** A small grey label on a line, e.g. DEFAULT beside a template's name. */
export function Tag({ label }: { label: string }) {
  return <Text style={styles.tag}>{label.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 52,
    paddingVertical: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: 0.6 },
  title: { flex: 1, fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.text },
  value: { flexShrink: 1, fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  track: {
    width: 48,
    height: 28,
    borderRadius: radius.round,
    backgroundColor: colors.line2,
    justifyContent: 'center',
  },
  trackOn: { backgroundColor: colors.accent },
  thumb: { width: 22, height: 22, borderRadius: radius.round, backgroundColor: colors.surface, marginLeft: 3 },
  thumbOn: { marginLeft: 23 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tag: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.text,
    backgroundColor: '#EFEBE3',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.round,
    overflow: 'hidden',
  },
});
