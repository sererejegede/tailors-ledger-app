import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import { Alert } from '@/lib/alert';
import {
  addThousands,
  bufferToMinor,
  deleteDigit,
  halfOf,
  minorToBuffer,
  pressDigit,
} from '@/lib/amountEntry';
import { newId } from '@/lib/ids';
import { DEFAULT_CURRENCY, formatMoney } from '@/lib/money';
import { confirmPayment } from '@/lib/overpayment';
import { formatWeekday } from '@/lib/time';
import { getClient } from '@/repositories/clients';
import { createJob, InvalidJobError } from '@/repositories/jobs';
import { setsForClient } from '@/repositories/sets';
import { getSettings } from '@/repositories/settings';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { AmountDock, JobDetailsSheet, JobItemSheet, type JobItemDraft } from '@/components/jobs';
import EditIcon from '@/assets/icons/edit-02.svg';
import PlusIcon from '@/assets/icons/plus.svg';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'RecordPayment'>;

/** One cloth while the job is in memory. `price` is the pad's buffer, in whole naira. */
type Line = { key: string; description: string; quantity: number; price: string; setId: string | null };

const PAYING = 'paying';

/**
 * Starts a job. Works like measuring: rows on top, pad in the thumb zone, + Add item last.
 * Tap a row to point the pad at it. Nothing is written until Save (lazy create, data-model
 * §1a), so Cancel leaves nothing behind.
 */
export default function RecordPaymentScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const insets = useSafeAreaInsets();
  const [clientName, setClientName] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [sets, setSets] = useState<{ id: string; name: string }[]>([]);

  const [lines, setLines] = useState<Line[]>([]);
  const [paying, setPaying] = useState('');
  const [title, setTitle] = useState('');
  const [collectOn, setCollectOn] = useState<number | null>(null);
  const [active, setActive] = useState(PAYING);
  const [itemSheet, setItemSheet] = useState<{ key?: string } | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    (async () => {
      const [client, settings, clientSets] = await Promise.all([
        getClient(database, clientId),
        getSettings(database),
        setsForClient(database, clientId),
      ]);
      setClientName(client?.name ?? '');
      setCurrency(settings?.currency || DEFAULT_CURRENCY);
      setSets(
        clientSets.map(({ set }) => ({
          id: set.id,
          name: set.label || set.templateNameSnapshot || 'Measurement set',
        })),
      );
    })();
  }, [clientId]);

  const totalMinor = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * bufferToMinor(l.price), 0),
    [lines],
  );

  // Every key on the pad goes to whichever row is active.
  const edit = useCallback(
    (change: (buffer: string) => string) => {
      if (active === PAYING) setPaying(change);
      else setLines((ls) => ls.map((l) => (l.key === active ? { ...l, price: change(l.price) } : l)));
    },
    [active],
  );

  const onDigit = useCallback((d: string) => edit((b) => pressDigit(b, d)), [edit]);
  const onDelete = useCallback(() => edit(deleteDigit), [edit]);
  const onThousands = useCallback(() => edit(addThousands), [edit]);

  const payPart = useCallback((buffer: string) => {
    setPaying(buffer);
    setActive(PAYING);
  }, []);
  const onHalf = useCallback(() => payPart(halfOf(totalMinor)), [payPart, totalMinor]);
  const onAll = useCallback(() => payPart(minorToBuffer(totalMinor)), [payPart, totalMinor]);

  const saveLine = (item: JobItemDraft) => {
    const key = itemSheet?.key;
    if (key) {
      setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...item, price: l.price } : l)));
    } else {
      const line = { key: newId(), price: '', ...item };
      setLines((ls) => [...ls, line]);
      setActive(line.key); // ready for the price
    }
    setItemSheet(null);
  };

  const removeLine = (key: string) => {
    setLines((ls) => ls.filter((l) => l.key !== key));
    setActive(PAYING);
    setItemSheet(null);
  };

  const save = useCallback(async () => {
    if (saving.current) return;
    saving.current = true;
    try {
      const { job, payment } = await createJob(database, {
        clientId,
        title,
        collectOn,
        items: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPriceMinor: l.price ? bufferToMinor(l.price) : null,
          setId: l.setId,
        })),
        amountMinor: bufferToMinor(paying),
      });
      // Replace, so back from here lands on Client detail, not a stale form.
      if (payment) navigation.replace('Receipt', { paymentId: payment.id });
      else navigation.replace('JobDetail', { jobId: job.id });
    } catch (e) {
      saving.current = false;
      if (e instanceof InvalidJobError) Alert.alert('Not saved yet', e.message);
      else throw e;
    }
  }, [clientId, title, collectOn, lines, paying, navigation]);

  // A new job owes its whole total, so that's the balance to check against.
  const onSave = useCallback(
    () => confirmPayment(totalMinor, bufferToMinor(paying), currency, save),
    [totalMinor, paying, currency, save],
  );

  // Every way out (Cancel, the phone's back button, a swipe) asks first once something is
  // entered. Save's own replace goes straight through.
  const entered = lines.length > 0 || !!paying || !!title || collectOn != null;
  usePreventRemove(entered, ({ data }) => {
    if (saving.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert('Discard this job?', 'Nothing has been saved.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const onCancel = () => navigation.goBack();

  const editing = lines.find((l) => l.key === itemSheet?.key);

  return (
    <View style={styles.screen}>
      <View style={[styles.topbar, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={onCancel} hitSlop={12} accessibilityRole="button">
          <Text style={styles.topAction}>Cancel</Text>
        </Pressable>
        <View style={styles.topTitle}>
          <Text style={styles.title}>Record payment</Text>
          <Text style={styles.client} numberOfLines={1}>
            {clientName}
          </Text>
        </View>
        <Pressable onPress={onSave} hitSlop={12} accessibilityRole="button">
          <Text style={styles.topAction}>Save</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>ITEMS</Text>
          <Pressable onPress={() => setDetailsOpen(true)} hitSlop={space.sm} accessibilityRole="button">
            <Text style={styles.collect} numberOfLines={1}>
              {collectOn != null ? `Collect ${formatWeekday(collectOn)}` : 'Add collection date'}
            </Text>
          </Pressable>
        </View>

        {lines.map((line) => {
          const on = active === line.key;
          const unit = bufferToMinor(line.price);
          return (
            <Pressable
              key={line.key}
              style={[styles.row, on && styles.rowOn]}
              onPress={() => setActive(line.key)}
              accessibilityRole="button"
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {line.description}
                </Text>
                {line.quantity > 1 ? (
                  <Text style={styles.rowDetail}>
                    {line.price ? `${line.quantity} × ${formatMoney(unit, currency)}` : `× ${line.quantity}`}
                  </Text>
                ) : null}
              </View>
              {on ? (
                <Pressable
                  onPress={() => setItemSheet({ key: line.key })}
                  hitSlop={space.sm}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${line.description}`}
                >
                  <EditIcon width={18} height={18} color={colors.accent} />
                </Pressable>
              ) : null}
              <Text style={[styles.rowValue, !line.price && styles.rowEmpty]}>
                {line.price ? formatMoney(line.quantity * unit, currency) : on ? formatMoney(0, currency) : '—'}
              </Text>
            </Pressable>
          );
        })}

        <Pressable style={styles.addRow} onPress={() => setItemSheet({})} accessibilityRole="button">
          <PlusIcon width={18} height={18} color={colors.accent} />
          <Text style={styles.addText}>Add item</Text>
        </Pressable>

        <View style={styles.totalRow}>
          <Text style={styles.total}>Total</Text>
          <Text style={[styles.rowValue, styles.total]}>{formatMoney(totalMinor, currency)}</Text>
        </View>

        <Pressable
          style={[styles.paying, active === PAYING && styles.payingOn]}
          onPress={() => setActive(PAYING)}
          accessibilityRole="button"
        >
          <Text style={styles.payingLabel}>Paying now</Text>
          <Text style={styles.payingValue}>{formatMoney(bufferToMinor(paying), currency)}</Text>
        </Pressable>
      </ScrollView>

      <View style={[styles.dock, { paddingBottom: insets.bottom + space.lg }]}>
        <AmountDock
          onDigit={onDigit}
          onDelete={onDelete}
          onThousands={onThousands}
          onHalf={onHalf}
          onAll={onAll}
          allLabel="All"
          onSave={onSave}
        />
      </View>

      {itemSheet ? (
        <JobItemSheet
          initial={
            editing && {
              description: editing.description,
              quantity: editing.quantity,
              unitPriceMinor: null,
              setId: editing.setId,
            }
          }
          sets={sets}
          onSave={saveLine}
          onRemove={editing ? () => removeLine(editing.key) : undefined}
          onClose={() => setItemSheet(null)}
        />
      ) : null}

      {detailsOpen ? (
        <JobDetailsSheet
          title={title}
          collectOn={collectOn}
          onSave={(details) => {
            setTitle(details.title);
            setCollectOn(details.collectOn);
            setDetailsOpen(false);
          }}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  topTitle: { flex: 1, alignItems: 'center' },
  title: { fontFamily: fonts.titleSemi, fontSize: fontSizes.lg, color: colors.text },
  client: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.muted },
  topAction: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.accent },
  list: { flex: 1 },
  listContent: { paddingHorizontal: space.lg, paddingBottom: space.md },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line2,
  },
  listTitle: { fontFamily: fonts.bold, fontSize: fontSizes.xs, letterSpacing: 1, color: colors.text },
  collect: { flexShrink: 1, fontFamily: fonts.medium, fontSize: fontSizes.xs, color: colors.accent },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    marginHorizontal: -space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowOn: { backgroundColor: colors.accentTint },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  rowDetail: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.muted },
  rowValue: { ...valueText, fontSize: fontSizes.lg, color: colors.text },
  rowEmpty: { color: colors.faint },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  addText: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.accent },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  total: { fontFamily: fonts.bold, color: colors.text },
  paying: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    marginHorizontal: -space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: colors.accentTint,
  },
  payingOn: { borderColor: colors.accent },
  payingLabel: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.accentInk },
  payingValue: { ...valueText, flexShrink: 1, fontSize: fontSizes['2xl'], fontWeight: '700', color: colors.accentInk },
  dock: {
    borderTopWidth: 1,
    borderTopColor: colors.line2,
    backgroundColor: colors.dockBg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
});
