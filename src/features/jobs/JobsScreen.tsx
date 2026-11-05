import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { database } from '@/db';
import { allJobRows } from '@/repositories/jobBoard';
import { filterJobs, groupJobs, jobState, startOfDay, type JobFilter, type JobRow } from '@/lib/jobBoard';
import { formatMoney } from '@/lib/money';
import { nowMs } from '@/lib/time';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { FadeInView, SectionLabel, TabTitle } from '@/components/ui';
import type { RootStackParamList, TabsParamList } from '@/navigation/types';

const FILTERS: { key: JobFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'owed', label: 'Still owed' },
  { key: 'paid', label: 'Paid' },
];

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The date box on a row: the weekday when it's within a week of today, else the month. */
function dayBadge(ms: number, now: number): { top: string; day: string } {
  const d = new Date(ms);
  const near = Math.abs(startOfDay(ms) - startOfDay(now)) < WEEK_MS;
  return { top: near ? WEEKDAYS[d.getDay()] : MONTHS[d.getMonth()], day: String(d.getDate()) };
}

/**
 * The Jobs tab (S4): every job, filtered All / Still owed / Paid and grouped by when it's
 * due. The Clients home tiles open it already filtered.
 */
export default function JobsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<TabsParamList, 'Jobs'>>();
  const [rows, setRows] = useState<JobRow[] | null>(null);
  const [filter, setFilter] = useState<JobFilter>(route.params?.filter ?? 'all');

  // A tile on the home opens this tab with a filter; follow it each time.
  const asked = route.params?.filter;
  useEffect(() => {
    if (asked) setFilter(asked);
  }, [asked]);

  useFocusEffect(
    useCallback(() => {
      allJobRows(database).then(setRows);
    }, []),
  );

  const now = nowMs();
  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, filterJobs(rows ?? [], f.key).length])) as Record<JobFilter, number>,
    [rows],
  );
  // Grouped against the clock when the data or the filter changes, not on every render.
  const sections = useMemo(
    () => groupJobs(filterJobs(rows ?? [], filter), nowMs()).map((s) => ({ ...s, data: s.rows })),
    [rows, filter],
  );

  return (
    <View style={styles.screen}>
      <TabTitle title="Jobs" />
      <View style={styles.filters} accessibilityRole="tablist">
        {FILTERS.map((f) => {
          const on = f.key === filter;
          return (
            <Pressable
              key={f.key}
              style={[styles.filter, on && styles.filterOn]}
              onPress={() => setFilter(f.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.filterText, on && styles.filterTextOn]}>
                {f.label} · {counts[f.key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {rows == null ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : (
        <FadeInView>
          <SectionList
            sections={sections}
            keyExtractor={(r) => r.jobId}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={styles.list}
            renderSectionHeader={({ section }) => <SectionLabel title={section.title} />}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {rows.length ? 'No jobs here.' : 'No jobs yet. Add one from a client’s page.'}
              </Text>
            }
            renderItem={({ item, index, section }) => (
              <JobListRow
                row={item}
                now={now}
                last={index === section.data.length - 1}
                onPress={() => navigation.navigate('JobDetail', { jobId: item.jobId })}
              />
            )}
          />
        </FadeInView>
      )}
    </View>
  );
}

function JobListRow({ row, now, last, onPress }: { row: JobRow; now: number; last: boolean; onPress: () => void }) {
  const state = jobState(row);
  const badge = row.collectOn != null ? dayBadge(row.collectOn, now) : null;
  const items = `${row.itemCount} ${row.itemCount === 1 ? 'item' : 'items'}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${row.label}, ${row.clientName}`}
    >
      <View style={styles.day}>
        {badge ? (
          <>
            <Text style={styles.dayTop}>{badge.top}</Text>
            <Text style={styles.dayNum}>{badge.day}</Text>
          </>
        ) : (
          <Text style={styles.dayNone}>—</Text>
        )}
      </View>
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {row.label}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {row.clientName} · {items}
        </Text>
      </View>
      {state === 'owed' ? (
        <View style={styles.amount}>
          <Text style={styles.amountValue}>{formatMoney(row.balanceMinor, row.currency)}</Text>
          <Text style={styles.amountLabel}>left</Text>
        </View>
      ) : (
        <Text style={styles.status}>{state === 'paid' ? 'Paid' : 'No price yet'}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: space.lg, paddingTop: space.sm },
  filter: {
    height: 36,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
  },
  filterOn: { backgroundColor: colors.text, borderColor: colors.text },
  filterText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.text },
  filterTextOn: { color: '#fff' },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  pressed: { opacity: 0.6 },
  day: { width: 44, alignItems: 'center' },
  dayTop: { fontFamily: fonts.bold, fontSize: fontSizes.xs, color: colors.muted },
  dayNum: { ...valueText, fontSize: fontSizes.xl, color: colors.text },
  dayNone: { fontFamily: fonts.bold, fontSize: fontSizes.lg, color: colors.muted },
  main: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
  amount: { alignItems: 'flex-end' },
  amountValue: { ...valueText, fontSize: fontSizes.base, fontWeight: '600', color: colors.text },
  amountLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.muted },
  status: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.muted },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.muted, textAlign: 'center', paddingTop: space.xl },
});
