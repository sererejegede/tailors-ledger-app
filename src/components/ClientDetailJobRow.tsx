import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '@/lib/money';
import { formatDayMonth, formatWeekday } from '@/lib/time';
import type { JobSummary } from '@/repositories/jobs';
import { colors, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';

type Props = { summary: JobSummary; onPress: () => void };

function ClientDetailJobRowBase({ summary, onPress }: Props) {
  const { job, label, itemCount, balanceMinor, totalMinor } = summary;
  const when = job.collectOn ? `Collect ${formatWeekday(job.collectOn)}` : formatDayMonth(job.createdAt.getTime());

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button">
      <View style={styles.text}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {itemCount} item{itemCount === 1 ? '' : 's'} • {when}
        </Text>
      </View>
      {balanceMinor > 0 ? (
        <Text style={styles.owed}>{formatMoney(balanceMinor, job.currency)} left</Text>
      ) : balanceMinor < 0 ? (
        <Text style={styles.meta}>{formatMoney(-balanceMinor, job.currency)} over</Text>
      ) : totalMinor > 0 ? (
        <Text style={styles.meta}>Paid</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  text: { flex: 1, minWidth: 0 },
  label: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  owed: { ...valueText, fontSize: fontSizes.sm, fontWeight: '700', color: colors.accent },
});

export const ClientDetailJobRow = memo(ClientDetailJobRowBase);
