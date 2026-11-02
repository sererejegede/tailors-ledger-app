import { useCallback, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import type JobItem from '@/db/models/JobItem';
import type Payment from '@/db/models/Payment';
import { formatMoney, formatReceiptNumber, lineTotalMinor } from '@/lib/money';
import { UNPRICED } from '@/lib/receipt';
import { formatDayMonth, formatWeekday } from '@/lib/time';
import { getClient } from '@/repositories/clients';
import {
  addJobItem,
  jobItems,
  jobPayments,
  jobSummary,
  recordPayment,
  removeJobItem,
  updateJob,
  updateJobItem,
  type JobSummary,
} from '@/repositories/jobs';
import { setsForClient } from '@/repositories/sets';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { JobDetailsSheet, JobItemSheet, RecordPaymentSheet, type JobItemDraft } from '@/components/jobs';
import PlusIcon from '@/assets/icons/plus.svg';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'JobDetail'>;

type Loaded = {
  summary: JobSummary;
  clientName: string;
  items: JobItem[];
  payments: Payment[];
  sets: { id: string; name: string }[];
};

/** The home of a job: what's owed, what's being made, what's been paid. */
export default function JobDetailScreen({ route, navigation }: Props) {
  const { jobId } = route.params;
  const insets = useSafeAreaInsets();
  const [data, setData] = useState<Loaded | null>(null);
  const [itemSheet, setItemSheet] = useState<{ item?: JobItem } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [paying, setPaying] = useState(false);

  const load = useCallback(async () => {
    const summary = await jobSummary(database, jobId);
    const client = await getClient(database, summary.job.client.id);
    const [items, payments, clientSets] = await Promise.all([
      jobItems(database, jobId),
      jobPayments(database, jobId),
      setsForClient(database, summary.job.client.id),
    ]);
    setData({
      summary,
      clientName: client?.name ?? '',
      items,
      payments,
      sets: clientSets.map(({ set }) => ({
        id: set.id,
        name: set.label || set.templateNameSnapshot || 'Measurement set',
      })),
    });
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: '' });
  }, [navigation]);

  const saveItem = async (draft: JobItemDraft) => {
    const editing = itemSheet?.item;
    setItemSheet(null);
    if (editing) await updateJobItem(database, editing.id, draft);
    else await addJobItem(database, jobId, draft);
    load();
  };

  const removeItem = async () => {
    const editing = itemSheet?.item;
    setItemSheet(null);
    if (editing) await removeJobItem(database, editing.id);
    load();
  };

  const saveDetails = async (details: { title: string; collectOn: number | null }) => {
    setDetailsOpen(false);
    await updateJob(database, jobId, details);
    load();
  };

  const savePayment = async (amountMinor: number) => {
    setPaying(false);
    const payment = await recordPayment(database, jobId, amountMinor);
    navigation.navigate('Receipt', { paymentId: payment.id });
  };

  if (!data) return <View style={styles.screen} />;

  const { summary, clientName, items, payments, sets } = data;
  const { job, label, totalMinor, paidMinor, balanceMinor } = summary;
  const money = (minor: number) => formatMoney(minor, job.currency);
  const setName = (id?: string | null) => sets.find((s) => s.id === id)?.name;
  const subtitle = [clientName, job.collectOn ? `Collect ${formatWeekday(job.collectOn)}` : null]
    .filter(Boolean)
    .join(' • ');
  const editing = itemSheet?.item;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => setDetailsOpen(true)} accessibilityRole="button" accessibilityLabel="Edit job details">
          <Text style={styles.title}>{label}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </Pressable>

        <View style={styles.balanceCard}>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceLabel}>Balance</Text>
            <Text style={styles.balanceValue}>{money(balanceMinor)}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceMeta}>Total {money(totalMinor)}</Text>
            <Text style={styles.balanceMeta}>Paid {money(paidMinor)}</Text>
          </View>
        </View>

        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ITEMS</Text>
            <Pressable style={styles.addButton} onPress={() => setItemSheet({})} hitSlop={space.sm} accessibilityRole="button">
              <PlusIcon width={16} height={16} color={colors.accent} />
              <Text style={styles.add}>Add item</Text>
            </Pressable>
          </View>
          {items.map((item) => {
            const priced = item.unitPriceMinor != null;
            const parts = [
              item.quantity > 1 && priced ? `${item.quantity} × ${money(item.unitPriceMinor!)}` : null,
              item.quantity > 1 && !priced ? `× ${item.quantity}` : null,
              setName(item.setId) ?? 'No measurements',
            ];
            return (
              <Pressable key={item.id} style={styles.row} onPress={() => setItemSheet({ item })} accessibilityRole="button">
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.description}
                  </Text>
                  <Text style={styles.rowMeta} numberOfLines={1}>
                    {parts.filter(Boolean).join(' • ')}
                  </Text>
                </View>
                <Text style={styles.rowValue}>
                  {priced ? money(lineTotalMinor(item.quantity, item.unitPriceMinor)) : UNPRICED}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PAYMENTS</Text>
          </View>
          {payments.length === 0 ? <Text style={styles.empty}>No payments yet.</Text> : null}
          {payments.map((payment) => {
            const voided = payment.voidedAt != null;
            return (
              <Pressable
                key={payment.id}
                style={styles.row}
                onPress={() => navigation.navigate('Receipt', { paymentId: payment.id })}
                accessibilityRole="button"
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, voided && styles.voided]}>
                    {voided ? 'Voided' : payment.receipt.kind}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {formatReceiptNumber(payment.receiptNumber)} • {formatDayMonth(payment.paidAt)}
                  </Text>
                </View>
                <Text style={[styles.rowValue, voided && styles.struck]}>{money(payment.amountMinor)}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable style={styles.record} onPress={() => setPaying(true)} accessibilityRole="button">
          <Text style={styles.recordText}>Record payment</Text>
        </Pressable>
      </View>

      {itemSheet ? (
        <JobItemSheet
          initial={
            editing && {
              description: editing.description,
              quantity: editing.quantity,
              unitPriceMinor: editing.unitPriceMinor ?? null,
              setId: editing.setId ?? null,
            }
          }
          sets={sets}
          withPrice
          onSave={saveItem}
          onRemove={editing ? removeItem : undefined}
          onClose={() => setItemSheet(null)}
        />
      ) : null}

      {detailsOpen ? (
        <JobDetailsSheet
          title={job.title ?? ''}
          collectOn={job.collectOn ?? null}
          onSave={saveDetails}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}

      {paying ? (
        <RecordPaymentSheet
          balanceMinor={balanceMinor}
          currency={job.currency}
          onSave={savePayment}
          onClose={() => setPaying(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingTop: space.sm, gap: space.lg },
  title: { fontFamily: fonts.titleSemi, fontSize: fontSizes.xl, color: colors.text },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  balanceCard: {
    backgroundColor: colors.accentTint,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    gap: space.xs,
  },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  balanceLabel: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.accentInk },
  balanceValue: { ...valueText, flexShrink: 1, fontSize: fontSizes['3xl'], fontWeight: '700', color: colors.accentInk },
  balanceMeta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.accentInk },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line2,
  },
  sectionTitle: { fontFamily: fonts.bold, fontSize: fontSizes.sm, letterSpacing: 1, color: colors.text },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  add: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  rowMeta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  rowValue: { ...valueText, fontSize: fontSizes.base, color: colors.text },
  voided: { color: colors.danger },
  struck: { color: colors.muted, textDecorationLine: 'line-through' },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.muted, paddingVertical: space.md },
  footer: { paddingHorizontal: space.lg, paddingTop: space.md },
  record: {
    height: 56,
    borderRadius: radius.default,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordText: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: '#fff' },
});
