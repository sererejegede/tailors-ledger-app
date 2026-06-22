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
import { setItems, attachClient } from '@/repositories/sets';
import { saveMeasurements, addAdHocItem } from '@/repositories/items';
import { DuplicateClientNameError } from '@/repositories/clients';
import { colors, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { Dock } from '@/components/Dock';
import { MeasurementRow } from '@/components/MeasurementRow';
import { PromptModal } from '@/components/PromptModal';
import type { RootStackParamList } from '@/navigation/types';
import { useMeasurementEntry, type EntrySeed, type Edit } from './useMeasurementEntry';

type Props = NativeStackScreenProps<RootStackParamList, 'MeasurementEntry'>;
type Meta = { templateName?: string; clientName: string; label?: string };
type Prompt = { mode: 'name' | 'addItem'; error?: string };

/**
 * The hero. Mirrors the paper card: scrollable item list + docked thumb-zone input.
 * No note/photo controls here, no bottom tabs (it's a stack route outside the tabs).
 */
export default function MeasurementEntryScreen({ route, navigation }: Props) {
  const { setId } = route.params;
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [seed, setSeed] = useState<EntrySeed[]>([]);
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
    const set = await database.get<MeasurementSet>(Tables.measurementSets).find(setId);
    const client = await set.client.fetch();
    const items = await setItems(database, setId);
    setSeed(items.map((it) => ({ itemId: it.id, key: it.key, initial: it.currentValue ?? null })));
    setMeta({
      templateName: set.templateNameSnapshot ?? undefined,
      clientName: client.name,
      label: set.label ?? undefined,
    });
    setLoading(false);
  }, [setId]);

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

  const persist = useCallback(
    async (edits: Edit[]) => {
      await saveMeasurements(database, setId, edits);
      if (isDraft) setPrompt({ mode: 'name' });
      else navigation.goBack();
    },
    [isDraft, navigation, setId],
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
        await attachClient(database, setId, { name: trimmed });
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
    [navigation, setId],
  );

  const submitAddItem = useCallback(
    async (key: string) => {
      const trimmed = key.trim();
      setPrompt(null);
      if (!trimmed) return;
      await addAdHocItem(database, setId, { key: trimmed });
      await load();
    },
    [load, setId],
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
          <Text style={styles.back}>‹</Text>
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
            <Text style={styles.sub}>{meta.label || 'New set'}</Text>
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
        message="Save the set against a client. You can add phone and notes later."
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
  back: { fontSize: 30, color: colors.accent, lineHeight: 32, width: 28 },
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
