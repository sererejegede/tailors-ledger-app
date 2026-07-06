import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Portal } from '@/components/OverlayHost';
import { FracChips, type Frac } from '@/components/FracChips';
import { NumberPad } from '@/components/NumberPad';
import { composeInches, formatInches, splitInches } from '@/lib/units';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';

/**
 * Single-item quick-edit sheet for Set detail (spec §5). Reuses the hero's number pad +
 * fraction chips over a tiny local whole+fraction buffer (mirroring useMeasurementEntry),
 * so editing one value feels identical to measuring. Saving calls the repo's
 * `quickEditItem`, which writes a history row only if the value actually changed.
 */
const MAX_WHOLE_DIGITS = 2; // inches 0–99, same cap as the dock

type Props = {
  visible: boolean;
  itemKey: string;
  initial: number | null;
  onCancel: () => void;
  onSave: (value: number) => void;
};

export function QuickEditSheet({ visible, itemKey, initial, onCancel, onSave }: Props) {
  const insets = useSafeAreaInsets();
  const [whole, setWhole] = useState('');
  const [frac, setFrac] = useState<Frac>(0);

  // Prefill from the current value whenever the sheet (re)opens.
  useEffect(() => {
    if (!visible) return;
    if (initial != null) {
      const s = splitInches(initial);
      setWhole(String(s.whole));
      setFrac(s.fraction);
    } else {
      setWhole('');
      setFrac(0);
    }
  }, [visible, initial]);

  if (!visible) return null;

  const typing = whole !== '' || frac > 0;
  const value = composeInches(parseInt(whole || '0', 10), frac);
  const display = typing ? formatInches(value) : formatInches(initial);

  const press = (d: string) => setWhole((w) => (w.length < MAX_WHOLE_DIGITS ? w + d : w));
  const del = () =>
    setWhole((w) => {
      if (w !== '') return w.slice(0, -1);
      setFrac(0);
      return w;
    });

  const save = () => {
    if (!typing && initial == null) {
      onCancel(); // nothing entered and nothing before → no-op
      return;
    }
    onSave(typing ? value : (initial as number));
  };

  return (
    <Portal>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.header}>
            <Text style={styles.key} numberOfLines={1}>
              {itemKey}
            </Text>
            <Text style={[styles.value, !typing && initial == null && styles.placeholder]}>
              {display}
            </Text>
          </View>
          <FracChips value={frac} onChange={setFrac} />
          <NumberPad onPress={press} onDelete={del} onNext={save} saveMode />
        </View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(27,26,23,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.dockBg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  key: { fontFamily: fonts.semibold, fontSize: fontSizes.lg, color: colors.text, flexShrink: 1 },
  value: { ...valueText, fontSize: fontSizes['3xl'], color: colors.accent },
  placeholder: { color: colors.faint },
});
