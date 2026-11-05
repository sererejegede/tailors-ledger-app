import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, nowMs } from '@/lib/time';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { buttonLabel, fonts } from '@/theme/typography';
import { BottomSheet } from './BottomSheet';
import { QUICK_PICKS } from './DueDateSheet';

/**
 * Set a job's collection date while sending its invoice: one tap on a quick pick saves it.
 * Once there is a date it can be cleared here too. Job detail's Change has the ± fine-tuning.
 */

type Props = {
  onPick: (collectOn: number) => void;
  /** Given only when the job has a date to clear. */
  onClear?: () => void;
  onClose: () => void;
};

export function CollectionDateSheet({ onPick, onClear, onClose }: Props) {
  return (
    <BottomSheet onClose={onClose}>
      <Text style={styles.heading}>Collection date</Text>
      <View style={styles.picks}>
        {QUICK_PICKS.map((pick) => (
          <Pressable
            key={pick.label}
            style={styles.pick}
            onPress={() => onPick(addDays(nowMs(), pick.days))}
            accessibilityRole="button"
          >
            <Text style={styles.pickText}>{pick.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>Saved to the job. Change on Job detail moves it by the day.</Text>
      {onClear ? (
        <Pressable style={styles.clear} onPress={onClear} accessibilityRole="button">
          <Text style={styles.clearText}>Clear date</Text>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  heading: { fontFamily: fonts.title, fontSize: fontSizes.xl, color: colors.text },
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
  pickText: { fontFamily: fonts.semibold, ...buttonLabel(fontSizes.sm), color: colors.text },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  clear: { height: 44, alignItems: 'center', justifyContent: 'center' },
  clearText: { fontFamily: fonts.semibold, ...buttonLabel(fontSizes.sm), color: colors.muted },
});
