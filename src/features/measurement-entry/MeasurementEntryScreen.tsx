import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  type LayoutChangeEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database, Tables } from '@/db';
import type MeasurementSet from '@/db/models/MeasurementSet';
import type Template from '@/db/models/Template';
import { setItems, createSetWithMeasurements, type NewMeasurementItem } from '@/repositories/sets';
import { saveMeasurements, addAdHocItem } from '@/repositories/items';
import { templateItems } from '@/repositories/templates';
import { getClient, DuplicateClientNameError } from '@/repositories/clients';
import { colors, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { Dock } from '@/components/Dock';
import { MeasurementRow } from '@/components/MeasurementRow';
import { PromptModal } from '@/components/PromptModal';
import type { RootStackParamList } from '@/navigation/types';
import { useMeasurementEntry, type EntrySeed, type Edit } from './useMeasurementEntry';
import BackIcon from '@/assets/icons/arrow-narrow-left.svg';

type Props = NativeStackScreenProps<RootStackParamList, 'MeasurementEntry'>;
type Meta = { templateName?: string; clientName: string; label?: string };
type Prompt = { mode: 'name' | 'addItem'; error?: string };
// In a NEW (not-yet-saved) set the rows are in-memory only: `tempId` is a client-side key
// used by the entry hook and to map entered values back to items at create time.
type NewItemDesc = { tempId: string; key: string; position: number; unit: string };

let tempIdSeq = 0;
const makeTempId = () => `tmp-${Date.now().toString(36)}-${tempIdSeq++}`;

/**
 * The hero. Mirrors the paper card: scrollable item list + docked thumb-zone input.
 * No note/photo controls here, no bottom tabs (it's a stack route outside the tabs).
 */
export default function MeasurementEntryScreen({ route, navigation }: Props) {
  const params = route.params;
  // Re-measure: an existing set. New: a templateId (+ optional clientId for client-first).
  const existingSetId = 'setId' in params ? params.setId : undefined;
  const templateId = 'templateId' in params ? params.templateId : undefined;
  const clientIdParam = 'clientId' in params ? params.clientId : undefined;
  const labelParam = 'label' in params ? params.label : undefined;
  const isNew = existingSetId == null;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [seed, setSeed] = useState<EntrySeed[]>([]);
  // New-mode item descriptors (parallel to `seed`); used to create rows on save.
  const [descriptors, setDescriptors] = useState<NewItemDesc[]>([]);
  const [meta, setMeta] = useState<Meta>({ clientName: '' });
  const [prompt, setPrompt] = useState<Prompt | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const scrollY = useRef(0); // current scroll offset
  const viewportH = useRef(0); // visible height of the list
  // Row offsets/heights, kept in a ref (NOT state): the rows animate their padding every
  // frame, so onLayout fires continuously — writing to a ref avoids a re-render storm, and
  // the scroll runs only on an active-item change.
  const rowLayouts = useRef<{ y: number; h: number }[]>([]);

  const onRowLayout = useCallback((index: number, e: LayoutChangeEvent) => {
    const { y, height } = e.nativeEvent.layout;
    rowLayouts.current[index] = { y, h: height };
  }, []);

  const load = useCallback(async () => {
    if (existingSetId) {
      // Re-measure: load the persisted set/items.
      const set = await database.get<MeasurementSet>(Tables.measurementSets).find(existingSetId);
      const client = await set.client.fetch();
      const items = await setItems(database, existingSetId);
      setSeed(items.map((it) => ({ itemId: it.id, key: it.key, initial: it.currentValue ?? null })));
      setMeta({
        templateName: set.templateNameSnapshot ?? undefined,
        clientName: client.name,
        label: set.label ?? undefined,
      });
    } else if (templateId) {
      // New: seed the list from the template in memory — nothing is written yet.
      const template = await database.get<Template>(Tables.templates).find(templateId);
      const tItems = await templateItems(database, templateId);
      const desc: NewItemDesc[] = tItems.map((ti) => ({
        tempId: makeTempId(),
        key: ti.key,
        position: ti.position,
        unit: ti.unit,
      }));
      setDescriptors(desc);
      setSeed(desc.map((d) => ({ itemId: d.tempId, key: d.key, initial: null })));
      const client = clientIdParam ? await getClient(database, clientIdParam) : null;
      setMeta({ templateName: template.name, clientName: client?.name ?? '', label: labelParam });
    }
    setLoading(false);
  }, [existingSetId, templateId, clientIdParam, labelParam]);

  useEffect(() => {
    load();
  }, [load]);

  const entry = useMeasurementEntry(seed);
  const isDraft = meta.clientName.trim() === '';

  // Keep the active row scrolled into view, but only when it isn't already (fires once per
  // active-item change; reads the latest measured layout from the ref).
  useEffect(() => {
    const l = rowLayouts.current[entry.active];
    if (!l || viewportH.current === 0) return;
    const margin = 12;
    const top = l.y;
    const bottom = l.y + l.h;
    const visibleTop = scrollY.current;
    const visibleBottom = scrollY.current + viewportH.current;
    if (top < visibleTop + margin) {
      scrollRef.current?.scrollTo({ y: Math.max(0, top - margin), animated: true });
    } else if (bottom > visibleBottom - margin) {
      scrollRef.current?.scrollTo({ y: bottom - viewportH.current + margin, animated: true });
    }
  }, [entry.active]);

  // Map the entry hook's edits (keyed by temp id) onto items to create for a new set.
  const buildNewItems = useCallback(
    (edits: Edit[]): NewMeasurementItem[] => {
      const byId = new Map(edits.map((e) => [e.itemId, e.value]));
      return descriptors.map((d) => ({
        key: d.key,
        position: d.position,
        unit: d.unit,
        value: byId.get(d.tempId) ?? null,
      }));
    },
    [descriptors],
  );

  const persist = useCallback(
    async (edits: Edit[]) => {
      if (isNew) {
        if (clientIdParam) {
          // client-first: create the set now under the existing client
          await createSetWithMeasurements(database, {
            templateId: templateId!,
            clientId: clientIdParam,
            label: labelParam,
            items: buildNewItems(edits),
          });
          navigation.goBack();
        } else {
          // measure-first draft: name it first — no rows are written until then
          setPrompt({ mode: 'name' });
        }
      } else {
        // re-measure: write history for changed items, then leave
        await saveMeasurements(database, existingSetId!, edits);
        navigation.goBack();
      }
    },
    [isNew, clientIdParam, templateId, labelParam, existingSetId, navigation, buildNewItems],
  );

  const onSave = useCallback(() => {
    const edits = entry.getEdits();
    const empty = entry.total - entry.filled;
    if (empty > 0) {
      Alert.alert(
        'Save measurements',
        `${empty} item${empty === 1 ? '' : 's'} still empty — save anyway?`,
        [
          { text: 'Keep measuring', style: 'cancel' },
          { text: 'Save anyway', onPress: () => persist(edits) },
        ],
      );
    } else {
      persist(edits);
    }
  }, [entry, persist]);

  const submitName = useCallback(
    async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) {
        setPrompt({ mode: 'name', error: 'Enter a name to save the set.' });
        return;
      }
      try {
        // The name prompt only opens for a measure-first draft: create the client + set
        // + measured values in one shot.
        await createSetWithMeasurements(database, {
          templateId: templateId!,
          clientName: trimmed,
          label: labelParam,
          items: buildNewItems(entry.getEdits()),
        });
        setPrompt(null);
        navigation.goBack();
      } catch (e) {
        if (e instanceof DuplicateClientNameError) {
          setPrompt({ mode: 'name', error: e.message });
        } else {
          setPrompt(null);
          Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
        }
      }
    },
    [templateId, labelParam, navigation, buildNewItems, entry],
  );

  const submitAddItem = useCallback(
    async (key: string) => {
      const trimmed = key.trim();
      setPrompt(null);
      if (!trimmed) return;
      if (isNew) {
        // ad-hoc item lives in memory until the set is saved
        const maxPos = descriptors.reduce((m, d) => Math.max(m, d.position), -1);
        const d: NewItemDesc = { tempId: makeTempId(), key: trimmed, position: maxPos + 1, unit: 'in' };
        setDescriptors((prev) => [...prev, d]);
        setSeed((prev) => [...prev, { itemId: d.tempId, key: trimmed, initial: null }]);
      } else {
        await addAdHocItem(database, existingSetId!, { key: trimmed });
        await load();
      }
    },
    [isNew, descriptors, existingSetId, load],
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* topbar (custom — this route hides the native header so tabs/header never intrude) */}
      <View style={[styles.topbar, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} accessibilityLabel="Back">
          <BackIcon width={28} height={28} color={colors.accent} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          Measure{meta.templateName ? ` · ${meta.templateName}` : ''}
        </Text>
        <Pressable onPress={onSave} hitSlop={12} accessibilityRole="button">
          <Text style={styles.save}>Save</Text>
        </Pressable>
      </View>

      {/* who + progress */}
      <View style={styles.entryHd}>
        {isDraft ? (
          <Pressable onPress={onSave}>
            <Text style={styles.unnamed}>Unnamed draft</Text>
            <Text style={styles.sub}>tap to name on save</Text>
          </Pressable>
        ) : (
          <View>
            <Text style={styles.who}>{meta.clientName}</Text>
            {meta.label ? <Text style={styles.sub}>{meta.label}</Text> : null}
          </View>
        )}
        <Text style={styles.progress}>
          <Text style={styles.progressNum}>{entry.filled}</Text>/{entry.total} filled
        </Text>
      </View>

      {/* item list */}
      <ScrollView
        ref={scrollRef}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollY.current = e.nativeEvent.contentOffset.y;
        }}
        onLayout={(e) => {
          viewportH.current = e.nativeEvent.layout.height;
        }}
      >
        <View>
          {entry.rows.map((r, i) => (
            <MeasurementRow
              key={r.itemId}
              itemKey={r.key}
              value={r.value}
              active={i === entry.active}
              changed={r.changed}
              activeDisplay={entry.dock.display}
              activePlaceholder={entry.dock.placeholder}
              onPress={() => entry.tapRow(i)}
              onLayout={(e) => onRowLayout(i, e)}
            />
          ))}
          <Pressable style={styles.addRow} onPress={() => setPrompt({ mode: 'addItem' })}>
            <Text style={styles.addText}>＋ Add item</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* docked input */}
      <View style={{ backgroundColor: colors.dockBg }}>
        <Dock
          frac={entry.dock.frac}
          onFrac={entry.setFrac}
          onDigit={entry.press}
          onDelete={entry.del}
          onNext={entry.commitNext}
        />
        <View style={{ height: insets.bottom }} />
      </View>

      <PromptModal
        visible={prompt?.mode === 'name'}
        title="Name this client"
        message="Save the set against a client."
        placeholder="Client name"
        submitLabel="Save set"
        error={prompt?.mode === 'name' ? prompt.error : undefined}
        onCancel={() => setPrompt(null)}
        onSubmit={submitName}
      />
      <PromptModal
        visible={prompt?.mode === 'addItem'}
        title="Add a measurement"
        message="Adds an item to this set only."
        placeholder="e.g. Cap circumference"
        submitLabel="Add item"
        onCancel={() => setPrompt(null)}
        onSubmit={submitAddItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  title: { fontFamily: fonts.titleSemi, fontSize: 18, color: colors.text, flex: 1, textAlign: 'center' },
  save: { fontFamily: fonts.bold, fontSize: 16, color: colors.accent },
  entryHd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  who: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  unnamed: { fontFamily: fonts.semibold, fontSize: 16, color: colors.accent },
  sub: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
  progress: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  progressNum: { fontFamily: fonts.bold, color: colors.text },
  list: { flex: 1 },
  addRow: { paddingVertical: space.md, paddingHorizontal: space.lg },
  addText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.accent },
});
