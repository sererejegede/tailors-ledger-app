import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '@/lib/money';
import { jobMeta, jobState, JOB_STATE_TITLES, type JobRow } from '@/lib/jobBoard';
import { colors, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';

type Props = { row: JobRow; now: number; last?: boolean; onPress: () => void };

/**
 * A job on Client detail (S2) and on all of a client's jobs (S2a): its name, "2 items ·
 * Due Fri 21 Nov", and what's left to pay, or Paid.
 */
function ClientDetailJobRowBase({ row, now, last, onPress }: Props) {
  const state = jobState(row);
  const left = state === 'owed' ? `${formatMoney(row.balanceMinor, row.currency)} left` : null;
  return (
    <Pressable
      style={({ pressed }) => [styles.row, last && styles.last, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${row.label}, ${left ?? JOB_STATE_TITLES[state]}`}
    >
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {row.label}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {jobMeta(row, now)}
        </Text>
      </View>
      {left ? <Text style={styles.left}>{left}</Text> : <Text style={styles.status}>{JOB_STATE_TITLES[state]}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: 0.6 },
  text: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
  left: { ...valueText, fontSize: fontSizes.base, fontWeight: '600', color: colors.text, textAlign: 'right' },
  status: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
});

export const ClientDetailJobRow = memo(ClientDetailJobRowBase);
