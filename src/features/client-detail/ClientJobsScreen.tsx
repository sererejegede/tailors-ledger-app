import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, SectionList, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import { getClient } from '@/repositories/clients';
import { jobRowsForClient } from '@/repositories/jobBoard';
import { totalOwedMinor } from '@/repositories/jobs';
import { groupByState, type JobRow } from '@/lib/jobBoard';
import { formatMoney } from '@/lib/money';
import { nowMs } from '@/lib/time';
import { colors, fontSizes, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { BottomBar, Button, FadeInView, ScreenHeader, SectionLabel } from '@/components/ui';
import { ClientDetailJobRow } from '@/components/ClientDetailJobRow';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ClientJobs'>;

/** S2a. Every job for one client, Still owed first, then Paid. Opens from Client detail. */
export default function ClientJobsScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const [name, setName] = useState('');
  const [rows, setRows] = useState<JobRow[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([getClient(database, clientId), jobRowsForClient(database, clientId)]).then(([client, jobs]) => {
        setName(client.name);
        setRows(jobs);
      });
    }, [clientId]),
  );

  const sections = useMemo(() => groupByState(rows ?? []).map((g) => ({ ...g, data: g.rows })), [rows]);
  const owed = totalOwedMinor(rows ?? []);
  const now = nowMs();
  const count = rows?.length ?? 0;

  return (
    <View style={styles.screen}>
      <ScreenHeader title={name ? `${name}'s jobs` : 'Jobs'} />
      {rows == null ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: space.xl }} />
      ) : (
        <FadeInView>
          <SectionList
            sections={sections}
            keyExtractor={(r) => r.jobId}
            stickySectionHeadersEnabled={false}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              count > 0 ? (
                <Text style={styles.summary}>
                  {count} {count === 1 ? 'job' : 'jobs'}
                  {owed > 0 ? (
                    <>
                      {' · '}
                      <Text style={styles.owed}>{formatMoney(owed, rows[0].currency)}</Text> still owed
                    </>
                  ) : null}
                </Text>
              ) : null
            }
            renderSectionHeader={({ section }) => <SectionLabel title={section.title} aside={String(section.data.length)} />}
            ListEmptyComponent={<Text style={styles.empty}>No jobs yet.</Text>}
            renderItem={({ item, index, section }) => (
              <ClientDetailJobRow
                row={item}
                now={now}
                last={index === section.data.length - 1}
                onPress={() => navigation.navigate('JobDetail', { jobId: item.jobId })}
              />
            )}
          />
        </FadeInView>
      )}
      <BottomBar>
        <Button kind="primary" label="Add job" onPress={() => navigation.navigate('NewJob', { clientId })} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  summary: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  owed: { ...valueText, fontWeight: '700', color: colors.text },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, paddingVertical: space.sm },
});
