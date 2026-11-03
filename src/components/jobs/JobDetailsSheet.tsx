import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { addDays, formatWeekday, nowMs } from '@/lib/time';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import MinusIcon from '@/assets/icons/minus.svg';
import PlusIcon from '@/assets/icons/plus.svg';
import { BottomSheet } from './BottomSheet';

/**
 * A job's title and collection date. Quick picks cover most jobs and ± fine-tunes by a day:
 * all thumb-reach, and the same on phone and web.
 */

export const QUICK_PICKS = [
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '3 weeks', days: 21 },
  { label: '1 month', days: 30 },
];

type Props = {
  title: string;
  collectOn: number | null;
  onSave: (details: { title: string; collectOn: number | null }) => void;
  onClose: () => void;
};

export function JobDetailsSheet({ title, collectOn, onSave, onClose }: Props) {
  const [name, setName] = useState(title);
  const [date, setDate] = useState(collectOn);

  const nudge = (days: number) => setDate((d) => addDays(d ?? nowMs(), days));

  return (
    <BottomSheet onClose={onClose}>
      <Text style={styles.heading}>Job details</Text>
      <TextInput
        style={styles.input}
        placeholder="Wedding outfits (optional)"
        placeholderTextColor={colors.faint}
        value={name}
        onChangeText={setName}
        autoCorrect={false}
        returnKeyType="done"
      />

      <Text style={styles.label}>Collection date</Text>
      <View style={styles.dateRow}>
        <Pressable style={styles.step} onPress={() => nudge(-1)} accessibilityRole="button" accessibilityLabel="A day earlier">
          <MinusIcon width={20} height={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.date, date == null && styles.dateEmpty]}>
          {date != null ? formatWeekday(date) : 'Not set'}
        </Text>
        <Pressable style={styles.step} onPress={() => nudge(1)} accessibilityRole="button" accessibilityLabel="A day later">
          <PlusIcon width={20} height={20} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.picks}>
        {QUICK_PICKS.map((pick) => (
          <Pressable
            key={pick.label}
            style={styles.pick}
            onPress={() => setDate(addDays(nowMs(), pick.days))}
            accessibilityRole="button"
          >
            <Text style={styles.pickText}>{pick.label}</Text>
          </Pressable>
        ))}
      </View>
      {date != null ? (
        <Pressable onPress={() => setDate(null)} hitSlop={space.sm} accessibilityRole="button">
          <Text style={styles.clear}>Clear date</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={styles.save}
        onPress={() => onSave({ title: name.trim(), collectOn: date })}
        accessibilityRole="button"
      >
        <Text style={styles.saveText}>Save</Text>
      </Pressable>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.title, fontSize: fontSizes.xl, color: colors.text },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: fontSizes.base,
    color: colors.text,
  },
  label: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  date: { ...valueText, fontSize: fontSizes.lg, color: colors.text },
  dateEmpty: { color: colors.faint },
  picks: { flexDirection: 'row', gap: space.sm },
  pick: {
    flex: 1,
    height: 44,
    borderRadius: radius.default,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  clear: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.muted, textAlign: 'center' },
  save: {
    height: 52,
    borderRadius: radius.default,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xs,
  },
  saveText: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: '#fff' },
});
