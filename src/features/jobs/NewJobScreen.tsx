import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { usePreventRemove } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import { Alert } from '@/lib/alert';
import { addDoubleZero, addThousands, bufferToMinor, deleteDigit, pressDigit } from '@/lib/amountEntry';
import { newId } from '@/lib/ids';
import { DEFAULT_CURRENCY, formatMoney } from '@/lib/money';
import { draftEntered, draftToItems, draftTotalMinor, type DraftLine } from '@/lib/newJob';
import { formatWeekday } from '@/lib/time';
import { getClient } from '@/repositories/clients';
import { createJob, InvalidJobError } from '@/repositories/jobs';
import { getSettings } from '@/repositories/settings';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { BottomBar, Button, ScreenHeader, SectionLabel, TextAction } from '@/components/ui';
import { DueDateSheet, PriceDock } from '@/components/jobs';
import PlusIcon from '@/assets/icons/plus.svg';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'NewJob'>;

const blankLine = (): DraftLine => ({ key: newId(), name: '', price: '' });

/**
 * S8 / S8a. A job's title, its items and a due date, with *Create job* at the bottom.
 * Each item takes a name on the phone keyboard; tapping its price (or "Add price") opens
 * the pad in place of the bottom bar, with Save in the corner. Nothing is written until
 * Create job (lazy create, data-model §1a), so backing out leaves nothing behind. Payments
 * are recorded on Job detail.
 */
export default function NewJobScreen({ route, navigation }: Props) {
  const { clientId } = route.params;
  const [clientName, setClientName] = useState('');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);
  const [title, setTitle] = useState('');
  const [lines, setLines] = useState<DraftLine[]>(() => [blankLine()]);
  const [collectOn, setCollectOn] = useState<number | null>(null);
  /** The line whose price the pad is typing, if the pad is open. */
  const [priceKey, setPriceKey] = useState<string | null>(null);
  /** A line just added, whose name field takes focus. */
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    (async () => {
      const [client, settings] = await Promise.all([getClient(database, clientId), getSettings(database)]);
      setClientName(client?.name ?? '');
      setCurrency(settings?.currency || DEFAULT_CURRENCY);
    })();
  }, [clientId]);

  const setLine = useCallback((key: string, change: Partial<DraftLine>) => {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...change } : l)));
  }, []);

  // Every pad key goes to the line being priced.
  const editPrice = useCallback(
    (change: (buffer: string) => string) => {
      if (priceKey) setLines((ls) => ls.map((l) => (l.key === priceKey ? { ...l, price: change(l.price) } : l)));
    },
    [priceKey],
  );
  const onDigit = useCallback((d: string) => editPrice((b) => pressDigit(b, d)), [editPrice]);
  const onDelete = useCallback(() => editPrice(deleteDigit), [editPrice]);
  const onThousands = useCallback(() => editPrice(addThousands), [editPrice]);
  const onDoubleZero = useCallback(() => editPrice(addDoubleZero), [editPrice]);
  const onClear = useCallback(() => editPrice(() => ''), [editPrice]);
  const closePad = useCallback(() => setPriceKey(null), []);

  const openPrice = (key: string) => {
    Keyboard.dismiss();
    setPriceKey(key);
  };

  const addItem = () => {
    const line = blankLine();
    setPriceKey(null);
    setLines((ls) => [...ls, line]);
    setFocusKey(line.key);
  };

  const create = useCallback(async () => {
    if (saving.current) return;
    const draft = draftToItems(lines);
    if ('error' in draft) {
      Alert.alert('Not created yet', draft.error);
      return;
    }
    saving.current = true;
    try {
      const { job } = await createJob(database, {
        clientId,
        title: title.trim() || undefined,
        collectOn,
        items: draft.items,
      });
      // Replace, so Back from Job detail lands on Client detail, not a stale form.
      navigation.replace('JobDetail', { jobId: job.id });
    } catch (e) {
      saving.current = false;
      if (e instanceof InvalidJobError) Alert.alert('Not created yet', e.message);
      else throw e;
    }
  }, [lines, clientId, title, collectOn, navigation]);

  // Back (the header arrow, the phone's back button or a swipe) first closes the price pad
  // when it's open. After that, every way out asks first once something is entered; Create
  // job goes straight through.
  usePreventRemove(priceKey != null || draftEntered(lines, title, collectOn), ({ data }) => {
    if (saving.current) {
      navigation.dispatch(data.action);
      return;
    }
    if (priceKey != null) {
      setPriceKey(null);
      return;
    }
    if (!draftEntered(lines, title, collectOn)) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert('Discard this job?', 'Nothing has been saved.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const pricing = lines.find((l) => l.key === priceKey);
  const total = draftTotalMinor(lines);

  return (
    <View style={styles.screen}>
      <ScreenHeader title="New job" />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {clientName ? <Text style={styles.for}>For {clientName}</Text> : null}

        <Text style={styles.fieldLabel}>Title (optional)</Text>
        <TextInput
          style={styles.field}
          value={title}
          onChangeText={setTitle}
          onFocus={closePad}
          placeholder="e.g. Wedding outfits"
          placeholderTextColor={colors.faint}
          autoCapitalize="sentences"
          returnKeyType="done"
          accessibilityLabel="Title (optional)"
        />

        <SectionLabel title="Items" />
        {lines.map((l) => {
          const on = l.key === priceKey;
          const priced = l.price !== '';
          return (
            <View key={l.key} style={[styles.item, on && styles.itemOn]}>
              {on ? <View style={styles.bar} /> : null}
              <TextInput
                style={[styles.name, priced && !on ? styles.namePlain : styles.field]}
                value={l.name}
                onChangeText={(name) => setLine(l.key, { name })}
                onFocus={closePad}
                autoFocus={l.key === focusKey}
                placeholder="Item, e.g. Agbada"
                placeholderTextColor={colors.faint}
                autoCapitalize="sentences"
                returnKeyType="done"
                accessibilityLabel="Item name"
              />
              {on ? (
                <View style={styles.slot}>
                  <Text style={styles.slotText}>{formatMoney(bufferToMinor(l.price), currency)}</Text>
                </View>
              ) : priced ? (
                <Pressable
                  onPress={() => openPrice(l.key)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Price ${formatMoney(bufferToMinor(l.price), currency)}. Change price`}
                >
                  <Text style={styles.price}>{formatMoney(bufferToMinor(l.price), currency)}</Text>
                </Pressable>
              ) : (
                <TextAction label="Add price" onPress={() => openPrice(l.key)} style={styles.addPrice} />
              )}
            </View>
          );
        })}
        <Pressable style={styles.addRow} onPress={addItem} accessibilityRole="button">
          <PlusIcon width={18} height={18} color={colors.accent} />
          <Text style={styles.addText}>Add item</Text>
        </Pressable>

        <View style={styles.due}>
          <View style={styles.dueText}>
            <Text style={styles.dueLabel}>Due</Text>
            <Text style={[styles.dueValue, collectOn == null && styles.dueEmpty]}>
              {collectOn != null ? formatWeekday(collectOn) : 'No date yet'}
            </Text>
          </View>
          <TextAction
            label={collectOn != null ? 'Change' : 'Add'}
            accessibilityLabel={collectOn != null ? 'Change due date' : 'Add due date'}
            onPress={() => {
              Keyboard.dismiss();
              setPriceKey(null);
              setDateOpen(true);
            }}
          />
        </View>

        <View style={styles.totalRow}>
          <Text style={styles.total}>Total</Text>
          <Text style={[styles.total, styles.totalValue]}>{formatMoney(total, currency)}</Text>
        </View>
        <Text style={styles.note}>Tap a price to type it on the number pad. Price is optional.</Text>
      </ScrollView>

      {pricing ? (
        <PriceDock
          itemName={pricing.name}
          onDigit={onDigit}
          onDelete={onDelete}
          onThousands={onThousands}
          onDoubleZero={onDoubleZero}
          onClear={onClear}
          onSave={closePad}
        />
      ) : (
        <BottomBar>
          <Button kind="primary" label="Create job" onPress={create} />
        </BottomBar>
      )}

      {dateOpen ? (
        <DueDateSheet
          collectOn={collectOn}
          onSave={(date) => {
            setCollectOn(date);
            setDateOpen(false);
          }}
          onClose={() => setDateOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  for: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, marginTop: -space.xs },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 13, color: colors.muted, marginTop: space.md, marginBottom: 6 },
  field: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    fontFamily: fonts.medium,
    fontSize: fontSizes.base,
    color: colors.text,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 64,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  itemOn: {
    marginHorizontal: -space.lg,
    paddingLeft: space.lg + 3,
    paddingRight: space.lg,
    minHeight: 72,
    backgroundColor: colors.accentTint,
  },
  bar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: colors.accent },
  name: { flex: 1, minHeight: 44 },
  namePlain: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text, paddingHorizontal: 0 },
  price: { ...valueText, fontSize: fontSizes.base, color: colors.text },
  addPrice: { alignSelf: 'center' },
  slot: {
    minWidth: 116,
    height: 44,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotText: { ...valueText, fontSize: fontSizes.xl, color: colors.accentInk },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  addText: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.accent },
  due: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dueText: { flex: 1 },
  dueLabel: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  dueValue: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  dueEmpty: { color: colors.muted },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 14 },
  total: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  totalValue: { ...valueText },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: space.sm },
});
