import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import ArrowRightIcon from '@/assets/icons/arrow-narrow-right.svg';

/**
 * The whole-number pad: 1–9, ⌫, 0, and a prominent action in the bottom-right cell
 * (wireframe layout). Everything sits in the thumb zone; entering a value is a few taps.
 * The action is **Next** while items remain to fill, and flips to **Save** once every
 * item has a value (and nothing is mid-entry) so finishing is one tap, not a hunt for the
 * top-bar Save.
 */
type Props = {
  onPress: (digit: string) => void;
  onDelete: () => void;
  onNext: () => void;
  saveMode?: boolean;
};

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

function NumberPadBase({ onPress, onDelete, onNext, saveMode = false }: Props) {
  return (
    <View style={styles.grid}>
      {DIGITS.map((d) => (
        <Pressable
          key={d}
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          onPress={() => onPress(d)}
          accessibilityRole="button"
          accessibilityLabel={d}
        >
          <Text style={styles.keyText}>{d}</Text>
        </Pressable>
      ))}
      <Pressable
        style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
        onPress={onDelete}
        accessibilityRole="button"
        accessibilityLabel="delete"
      >
        <Text style={styles.keyText}>⌫</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
        onPress={() => onPress('0')}
        accessibilityRole="button"
        accessibilityLabel="0"
      >
        <Text style={styles.keyText}>0</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.key, styles.next, pressed && styles.nextPressed]}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel={saveMode ? 'Save' : 'Next'}
      >
        <Text style={styles.nextText}>{saveMode ? 'Save' : 'Next'}</Text>
        {saveMode ? null : <ArrowRightIcon color="#fff" />}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  key: {
    // 3 per row accounting for the row gap
    width: '31.7%',
    height: 56,
    borderRadius: radius.default,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { backgroundColor: colors.line },
  keyText: { ...valueText, fontSize: fontSizes['2xl'], color: colors.text },
  next: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  nextPressed: { backgroundColor: colors.accentInk },
  nextText: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: '#fff', lineHeight: 18 },
});

export const NumberPad = memo(NumberPadBase);
