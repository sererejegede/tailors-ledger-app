import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheet } from '@/components/jobs/BottomSheet';
import { FracChips, type Frac } from '@/components/FracChips';
import { NumberPad } from '@/components/NumberPad';
import { composeInches, formatInches } from '@/lib/units';
import { historyRows } from '@/lib/setDetail';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import XCloseIcon from '@/assets/icons/x-close.svg';
import { Cursor } from '@/components/ui/Cursor';

/**
 * One item (S7), opened from Set detail: the new value, the item's history, the fraction
 * chips and the pad with Save in the corner. The pad starts empty, as on the measuring
 * screen: the current value shows faintly until something is typed, and Save with nothing
 * typed just closes. Saving calls `quickEditItem`, which writes history only when the
 * value changed (spec §5). Mount it to open it.
 */
const MAX_WHOLE_DIGITS = 2; // inches 0–99, same cap as the dock

type Props = {
  itemKey: string;
  current: number | null;
  currentAt: number | null;
  /** Earlier values, newest first, without the current one. */
  earlier: { id: string; value: number; recordedAt: number }[];
  onClose: () => void;
  onSave: (value: number) => void;
};

export function ItemSheet({ itemKey, current, currentAt, earlier, onClose, onSave }: Props) {
  const [whole, setWhole] = useState('');
  const [frac, setFrac] = useState<Frac>(0);

  const typing = whole !== '' || frac > 0;
  const value = composeInches(parseInt(whole || '0', 10), frac);
  const history = historyRows({ value: current, at: currentAt }, earlier);

  const press = (d: string) => setWhole((w) => (w.length < MAX_WHOLE_DIGITS ? w + d : w));
  const del = () =>
    setWhole((w) => {
      if (w !== '') return w.slice(0, -1);
      setFrac(0);
      return w;
    });
  const save = () => (typing ? onSave(value) : onClose());

  return (
    <BottomSheet onClose={onClose}>
      <View style={styles.head}>
        <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
          {itemKey}
        </Text>
        <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
          <XCloseIcon width={22} height={22} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.newValue}>
        <Text style={styles.newLabel}>New value</Text>
        <View style={styles.newRow}>
          {typing ? null : <Cursor height={32} />}
          <Text style={[styles.newNum, !typing && styles.faint]}>{formatInches(typing ? value : current)}</Text>
          {typing ? <Cursor height={32} /> : null}
        </View>
      </View>

      {history.length > 0 ? (
        <View>
          <Text style={styles.histLabel}>HISTORY</Text>
          {history.map((h, i) => (
            <View key={h.key} style={[styles.histRow, i === history.length - 1 && styles.last]}>
              <Text style={[styles.histWhen, !h.now && styles.muted]}>{h.when}</Text>
              <Text style={[styles.histValue, h.now ? styles.histNow : styles.muted]}>{formatInches(h.value)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View>
        <FracChips value={frac} onChange={setFrac} />
        <NumberPad onPress={press} onDelete={del} onNext={save} saveMode />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -space.sm },
  title: { flex: 1, fontFamily: fonts.titleSemi, fontSize: 22, color: colors.text },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm },
  newValue: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentTint,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  newRow: { flexDirection: 'row', alignItems: 'center' },
  newLabel: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.accentInk },
  newNum: { ...valueText, fontSize: fontSizes['4xl'], color: colors.accentInk },
  faint: { color: colors.faint },
  histLabel: { fontFamily: fonts.bold, fontSize: fontSizes.xs, letterSpacing: 1, color: colors.muted, marginBottom: 2 },
  histRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  histWhen: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text },
  histValue: { ...valueText, fontSize: fontSizes.sm },
  histNow: { color: colors.text },
  muted: { color: colors.muted },
});
