import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addDays, nowMs } from '@/lib/time';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { BottomSheet } from './BottomSheet';
import { QUICK_PICKS } from './JobDetailsSheet';

/**
 * Set a job's collection date while sending its invoice: one tap on a quick pick saves it.
 * There's deliberately no clear here; Job details still has that, and the ± fine-tuning.
 */

type Props = { onPick: (collectOn: number) => void; onClose: () => void };

export function CollectionDateSheet({ onPick, onClose }: Props) {
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
      <Text style={styles.hint}>Saved to the job. Job details fine-tunes it by the day.</Text>
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
  pickText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
});
