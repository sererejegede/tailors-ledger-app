import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSizes, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { BottomSheet } from '@/components/jobs/BottomSheet';
import CheckIcon from '@/assets/icons/check.svg';

type Option = {
  id: string;
  name: string;
};

type Props = {
  visible: boolean;
  /** The sheet's title, e.g. "Fraction steps". */
  title?: string;
  options: Option[];
  currentId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  /** Unused: the sheet adds the safe area itself. Kept so callers don't change. */
  bottomInset?: number;
};

/** Pick one from a short list, in a sheet from the bottom. The chosen one has a check. */
export function ItemPickerSheet({ visible, title = 'Choose', options, currentId, onSelect, onClose }: Props) {
  if (!visible) return null;
  return (
    <BottomSheet onClose={onClose}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View>
      {options.map((o, i) => {
        const current = o.id === currentId;
        return (
          <Pressable
            key={o.id}
            style={({ pressed }) => [styles.option, i === options.length - 1 && styles.last, pressed && styles.pressed]}
            onPress={() => onSelect(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: current }}
          >
            <Text style={[styles.optionText, current && styles.optionCurrent]}>{o.name}</Text>
            {current ? <CheckIcon width={18} height={18} color={colors.accent} /> : null}
          </Pressable>
        );
      })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontFamily: fonts.titleSemi, fontSize: 22, color: colors.text },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: 0.6 },
  optionText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.text },
  optionCurrent: { color: colors.accent, fontFamily: fonts.semibold },
});
