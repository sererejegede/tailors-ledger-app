import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, formatWeekday, nowMs } from '@/lib/time';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { buttonLabel, fonts, valueText } from '@/theme/typography';
import { Button, TextAction } from '@/components/ui';
import MinusIcon from '@/assets/icons/minus.svg';
import PlusIcon from '@/assets/icons/plus.svg';
import { BottomSheet } from './BottomSheet';
import { QUICK_PICKS } from './JobDetailsSheet';

/**
 * A job's due (collection) date: quick picks for most jobs and ± to move it by a day, so
 * there's no calendar to fish through (spec §9a). It can be cleared. Mount it to open it.
 */
type Props = {
  collectOn: number | null;
  onSave: (collectOn: number | null) => void;
  onClose: () => void;
};

export function DueDateSheet({ collectOn, onSave, onClose }: Props) {
  const [date, setDate] = useState(collectOn);
  const nudge = (days: number) => setDate((d) => addDays(d ?? nowMs(), days));

  return (
    <BottomSheet onClose={onClose}>
      <Text style={styles.heading}>Due date</Text>
      <View style={styles.dateRow}>
        <Pressable style={styles.step} onPress={() => nudge(-1)} accessibilityRole="button" accessibilityLabel="A day earlier">
          <MinusIcon width={20} height={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.date, date == null && styles.dateEmpty]}>{date != null ? formatWeekday(date) : 'No date yet'}</Text>
        <Pressable style={styles.step} onPress={() => nudge(1)} accessibilityRole="button" accessibilityLabel="A day later">
          <PlusIcon width={20} height={20} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.picks}>
        {QUICK_PICKS.map((pick) => (
          <Pressable
            key={pick.label}
            style={({ pressed }) => [styles.pick, pressed && styles.pressed]}
            onPress={() => setDate(addDays(nowMs(), pick.days))}
            accessibilityRole="button"
          >
            <Text style={styles.pickText}>{pick.label}</Text>
          </Pressable>
        ))}
      </View>
      {date != null ? <TextAction label="Clear date" onPress={() => setDate(null)} style={styles.clear} /> : null}
      <View style={styles.actions}>
        <Button kind="primary" label="Save" onPress={() => onSave(date)} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.titleSemi, fontSize: 22, color: colors.text },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  step: {
    width: 44,
    height: 44,
    borderRadius: radius.round,
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
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.85 },
  pickText: { fontFamily: fonts.semibold, ...buttonLabel(fontSizes.sm), color: colors.text },
  clear: { alignSelf: 'center', minHeight: 32 },
  actions: { flexDirection: 'row' },
});
