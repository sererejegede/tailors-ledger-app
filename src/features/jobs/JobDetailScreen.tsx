import { useCallback, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import type JobItem from '@/db/models/JobItem';
import type Payment from '@/db/models/Payment';
import { Alert } from '@/lib/alert';
import { addDoubleZero, addThousands, bufferToMinor, deleteDigit, minorToBuffer, pressDigit } from '@/lib/amountEntry';
import { itemEdit, itemPrice, paidShare } from '@/lib/jobDetail';
import { formatMoney, formatReceiptNumber } from '@/lib/money';
import { formatDayMonth, formatWeekday } from '@/lib/time';
import { getClient } from '@/repositories/clients';
import { getSettings } from '@/repositories/settings';
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
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { BottomBar, Button, Cursor, NameSheet, ScreenHeader, SectionLabel, TextAction } from '@/components/ui';
import { DueDateSheet, PriceDock, RecordPaymentSheet } from '@/components/jobs';
import ChevronIcon from '@/assets/icons/chevron-right.svg';
import PlusIcon from '@/assets/icons/plus.svg';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'JobDetail'>;

type Loaded = {
  summary: JobSummary;
  clientName: string;
  items: JobItem[];
  payments: Payment[];
  /** A receipt keeps the shop details it's saved with, so a missing name is worth a word first. */
  shopNamed: boolean;
};

/** The item being typed in the list: an existing one (its id) or a new one. */
/** The item being typed. `pricing`: the pad is open on its price (only once the price is tapped). */
type Editing = { id: string | null; name: string; price: string; pricing: boolean };
type Sheet = 'due' | 'title' | 'pay' | null;

/**
 * S9 / S9a. A job's balance, who it's for, its due date and title, its items and its
 * payments. Items are added or repriced in the list: a new item starts on its name (the
 * phone keyboard), and the pad takes the place of the bottom bar only while the price is
 * being typed, with Save in the corner. Tapping an existing item opens it on its price. *Record payment* opens the
 * amount pad (S9b), and Save opens the new receipt.
 */
export default function JobDetailScreen({ route, navigation }: Props) {
  const { jobId } = route.params;
  const [data, setData] = useState<Loaded | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);

  const load = useCallback(async () => {
    const summary = await jobSummary(database, jobId);
    const [client, items, payments, settings] = await Promise.all([
      getClient(database, summary.job.client.id),
      jobItems(database, jobId),
      jobPayments(database, jobId),
      getSettings(database),
    ]);
    setData({ summary, clientName: client?.name ?? '', items, payments, shopNamed: !!settings?.shopName?.trim() });
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Back closes the item being typed before it leaves the screen. On a new item it first
  // closes the price pad, back to the name (as on New job).
  usePreventRemove(editing != null, () =>
    setEditing((e) => (e && e.id == null && e.pricing ? { ...e, pricing: false } : null)),
  );

  const editPrice = useCallback((change: (buffer: string) => string) => {
    setEditing((e) => (e ? { ...e, price: change(e.price) } : e));
  }, []);
  const onDigit = useCallback((d: string) => editPrice((b) => pressDigit(b, d)), [editPrice]);
  const onDelete = useCallback(() => editPrice(deleteDigit), [editPrice]);
  const onThousands = useCallback(() => editPrice(addThousands), [editPrice]);
  const onDoubleZero = useCallback(() => editPrice(addDoubleZero), [editPrice]);
  const onClear = useCallback(() => editPrice(() => ''), [editPrice]);

  // The name and the price take turns: the keyboard for one, the pad for the other.
  const openPad = useCallback(() => {
    Keyboard.dismiss();
    setEditing((e) => (e ? { ...e, pricing: true } : e));
  }, []);
  const closePad = useCallback(() => setEditing((e) => (e && e.pricing ? { ...e, pricing: false } : e)), []);

  const saveItem = useCallback(async () => {
    if (!editing) return;
    const edit = itemEdit(editing.name, editing.price);
    if ('error' in edit) {
      Alert.alert('Not saved yet', edit.error);
      return;
    }
    setEditing(null);
    if (editing.id) await updateJobItem(database, editing.id, edit);
    else await addJobItem(database, jobId, { ...edit, quantity: 1 });
    load();
  }, [editing, jobId, load]);

  const removeItem = useCallback(() => {
    const id = editing?.id;
    if (!id) {
      setEditing(null);
      return;
    }
    Alert.alert('Remove this item?', 'It comes off the job and its total.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setEditing(null);
          await removeJobItem(database, id);
          load();
        },
      },
    ]);
  }, [editing, load]);

  const saveDue = async (collectOn: number | null) => {
    setSheet(null);
    await updateJob(database, jobId, { collectOn });
    load();
  };

  const saveTitle = async (title: string) => {
    setSheet(null);
    await updateJob(database, jobId, { title: title.trim() });
    load();
  };

  const savePayment = async (amountMinor: number) => {
    setSheet(null);
    const payment = await recordPayment(database, jobId, amountMinor);
    navigation.navigate('Receipt', { paymentId: payment.id });
  };

  const closeSheet = useCallback(() => setSheet(null), []);

  if (!data) return <View style={styles.screen} />;

  const { summary, clientName, items, payments, shopNamed } = data;
  const { job, label, totalMinor, paidMinor, balanceMinor } = summary;
  const money = (minor: number) => formatMoney(minor, job.currency);
  const newRow = editing && editing.id == null;

  const openItem = (item: JobItem) => {
    Keyboard.dismiss();
    setEditing({ id: item.id, name: item.description, price: minorToBuffer(item.unitPriceMinor ?? 0), pricing: true });
  };

  const editingRow = (e: Editing) => (
    <View style={styles.itemOn}>
      <View style={styles.bar} />
      <TextInput
        style={styles.nameField}
        value={e.name}
        onChangeText={(name) => setEditing((cur) => (cur ? { ...cur, name } : cur))}
        autoFocus={e.id == null}
        placeholder="Item, e.g. Agbada"
        placeholderTextColor={colors.faint}
        autoCapitalize="sentences"
        returnKeyType="next"
        onFocus={closePad}
        onSubmitEditing={openPad}
        accessibilityLabel="Item name"
      />
      <Pressable
        style={[styles.slot, !e.pricing && styles.slotIdle]}
        onPress={openPad}
        accessibilityRole="button"
        accessibilityLabel={e.price ? `Price ${money(bufferToMinor(e.price))}` : 'Add price'}
      >
        {e.pricing || e.price ? (
          <Text style={[styles.slotText, !e.pricing && styles.slotTextIdle]}>{money(bufferToMinor(e.price))}</Text>
        ) : (
          <Text style={styles.slotHint}>Add price</Text>
        )}
        {e.pricing ? <Cursor height={20} /> : null}
      </Pressable>
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScreenHeader title={label} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Balance</Text>
          <Text style={styles.balance} numberOfLines={1}>
            {money(balanceMinor)}
          </Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${paidShare(paidMinor, totalMinor) * 100}%` }]} />
          </View>
          <View style={styles.cardFoot}>
            <Text style={styles.cardMeta}>
              Paid <Text style={styles.cardNum}>{money(paidMinor)}</Text>
            </Text>
            <Text style={styles.cardMeta}>
              Total <Text style={styles.cardNum}>{money(totalMinor)}</Text>
            </Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.row, styles.first, pressed && styles.pressed]}
          onPress={() => navigation.popTo('ClientDetail', { clientId: job.client.id })}
          accessibilityRole="button"
          accessibilityLabel={`Client ${clientName}`}
        >
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Client</Text>
            <Text style={styles.rowName}>{clientName}</Text>
          </View>
          <ChevronIcon width={18} height={18} color={colors.faint} />
        </Pressable>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Due</Text>
            <Text style={[styles.rowName, !job.collectOn && styles.muted]}>
              {job.collectOn ? formatWeekday(job.collectOn) : 'No date yet'}
            </Text>
          </View>
          <TextAction
            label={job.collectOn ? 'Change' : 'Add'}
            accessibilityLabel={job.collectOn ? 'Change due date' : 'Add due date'}
            onPress={() => setSheet('due')}
          />
        </View>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowLabel}>Title</Text>
            <Text style={[styles.rowName, !job.title && styles.muted]}>{job.title || 'No title'}</Text>
          </View>
          <TextAction
            label={job.title ? 'Rename' : 'Add'}
            accessibilityLabel={job.title ? 'Rename job' : 'Add a title'}
            onPress={() => setSheet('title')}
          />
        </View>

        <SectionLabel title="Items" aside={money(totalMinor)} asideIsNumber />
        {items.map((item) => {
          if (editing?.id === item.id) return <View key={item.id}>{editingRow(editing)}</View>;
          const price = itemPrice(item.quantity, item.unitPriceMinor, job.currency);
          return (
            <Pressable
              key={item.id}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => openItem(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.description}, ${price ? price.amount : 'no price yet'}`}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.description}
                </Text>
                {price?.times ? <Text style={styles.rowLabel}>{price.times}</Text> : null}
              </View>
              {price ? (
                <Text style={styles.amount}>{price.amount}</Text>
              ) : (
                <Text style={styles.addPrice}>Add price</Text>
              )}
            </Pressable>
          );
        })}
        {newRow ? editingRow(editing) : null}
        <Pressable
          style={styles.addRow}
          onPress={() => setEditing({ id: null, name: '', price: '', pricing: false })}
          accessibilityRole="button"
        >
          <PlusIcon width={18} height={18} color={colors.accent} />
          <Text style={styles.addText}>Add item</Text>
        </Pressable>

        <SectionLabel title="Payments" />
        {payments.length === 0 ? <Text style={styles.empty}>No payments yet.</Text> : null}
        {payments.map((payment, i) => {
          const voided = payment.voidedAt != null;
          return (
            <Pressable
              key={payment.id}
              style={({ pressed }) => [styles.row, i === payments.length - 1 && styles.last, pressed && styles.pressed]}
              onPress={() => navigation.navigate('Receipt', { paymentId: payment.id })}
              accessibilityRole="button"
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowName, voided && styles.voided]}>{voided ? 'Voided' : payment.receipt.kind}</Text>
                <Text style={styles.rowLabel}>
                  {formatReceiptNumber(payment.receiptNumber)} · {formatDayMonth(payment.paidAt)}
                </Text>
              </View>
              <Text style={[styles.amount, voided && styles.struck]}>{money(payment.amountMinor)}</Text>
              <ChevronIcon width={18} height={18} color={colors.faint} />
            </Pressable>
          );
        })}
      </ScrollView>

      {/* While a name is being typed the keyboard is up, so neither the pad nor the bar shows. */}
      {editing && !editing.pricing ? null : editing ? (
        <PriceDock
          itemName={editing.name}
          onDigit={onDigit}
          onDelete={onDelete}
          onThousands={onThousands}
          onDoubleZero={onDoubleZero}
          onClear={onClear}
          onSave={saveItem}
          onRemove={removeItem}
        />
      ) : (
        <BottomBar>
          <Button label="Send invoice" onPress={() => navigation.navigate('Invoice', { jobId })} />
          <Button kind="primary" label="Record payment" onPress={() => setSheet('pay')} />
        </BottomBar>
      )}

      {sheet === 'due' ? (
        <DueDateSheet collectOn={job.collectOn ?? null} onSave={saveDue} onClose={closeSheet} />
      ) : null}
      {sheet === 'title' ? (
        <NameSheet
          title={job.title ? 'Rename job' : 'Add a title'}
          placeholder="e.g. Wedding outfits"
          initialValue={job.title ?? ''}
          submitLabel="Save"
          optional
          onClose={closeSheet}
          onSubmit={saveTitle}
        />
      ) : null}
      {sheet === 'pay' ? (
        <RecordPaymentSheet
          jobLabel={label}
          balanceMinor={balanceMinor}
          currency={job.currency}
          onSave={savePayment}
          onSetUpShop={
            shopNamed
              ? undefined
              : () => {
                  closeSheet();
                  navigation.navigate('ShopProfile');
                }
          }
          onClose={closeSheet}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  cardLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  balance: { ...valueText, fontSize: 34, color: colors.text, marginTop: 2, marginBottom: 10 },
  track: { height: 6, borderRadius: radius.round, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.round, backgroundColor: colors.text },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm },
  cardMeta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  cardNum: { ...valueText, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  first: { marginTop: 6 },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: 0.7 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  rowName: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  muted: { color: colors.muted },
  amount: { ...valueText, fontSize: fontSizes.base, color: colors.text },
  addPrice: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  voided: { color: colors.danger },
  struck: { color: colors.muted, textDecorationLine: 'line-through' },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.muted, paddingVertical: space.md },
  itemOn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 72,
    marginHorizontal: -space.lg,
    paddingLeft: space.lg + 3,
    paddingRight: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.accentTint,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.accent },
  nameField: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.text,
  },
  slot: {
    minWidth: 116,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Not being typed: a plain field, until it's tapped.
  slotIdle: { borderColor: colors.line2 },
  slotText: { ...valueText, fontSize: fontSizes.xl, color: colors.accentInk },
  slotTextIdle: { color: colors.text },
  slotHint: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.muted },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  addText: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.accent },
});
