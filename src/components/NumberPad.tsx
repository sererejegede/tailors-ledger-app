import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { buttonLabel, fonts, valueText } from '@/theme/typography';
import ArrowRightIcon from '@/assets/icons/arrow-narrow-right.svg';
import DeleteIcon from '@/assets/icons/delete.svg';

/**
 * The whole-number pad: 1–9, delete, 0, and a prominent action in the bottom-right cell
 * (wireframe layout). Everything sits in the thumb zone; entering a value is a few taps.
 * On the measuring screen the action is **Next**, with a 1px maroon border (it has focus);
 * Save set lives on the dock's top line. Sheets that save a single value (an amount, a
 * quick edit) pass `saveMode`, and the corner becomes a solid **Save**.
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
        <DeleteIcon width={26} height={26} color={colors.text} />
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
        style={({ pressed }) => [
          styles.key,
          saveMode ? styles.save : styles.next,
          pressed && (saveMode ? styles.savePressed : styles.nextPressed),
        ]}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel={saveMode ? 'Save' : 'Next'}
      >
        <Text style={[styles.nextText, saveMode ? styles.saveText : null]}>{saveMode ? 'Save' : 'Next'}</Text>
        {saveMode ? null : <ArrowRightIcon width={20} height={20} color={colors.accent} />}
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
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyPressed: { backgroundColor: colors.line },
  keyText: { ...valueText, fontSize: fontSizes['2xl'], includeFontPadding: false, color: colors.text },
  next: { borderColor: colors.accent, flexDirection: 'row', gap: 6 },
  nextPressed: { backgroundColor: colors.accentTint },
  save: { backgroundColor: colors.accent, borderColor: colors.accent },
  savePressed: { backgroundColor: colors.accentInk },
  nextText: { fontFamily: fonts.bold, ...buttonLabel(fontSizes.lg), color: colors.accent, lineHeight: 18 },
  saveText: { color: '#fff' },
});

export const NumberPad = memo(NumberPadBase);
