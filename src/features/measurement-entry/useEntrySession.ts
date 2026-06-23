import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database, Tables } from '@/db';
import type MeasurementSet from '@/db/models/MeasurementSet';
import type Template from '@/db/models/Template';
import { setItems, createSetWithMeasurements, type NewMeasurementItem } from '@/repositories/sets';
import { saveMeasurements, addAdHocItem } from '@/repositories/items';
import { templateItems, listTemplates } from '@/repositories/templates';
import { getClient, createClient, DuplicateClientNameError } from '@/repositories/clients';
import type { RootStackParamList } from '@/navigation/types';
import { useMeasurementEntry, type EntrySeed, type Edit } from './useMeasurementEntry';

type Props = NativeStackScreenProps<RootStackParamList, 'MeasurementEntry'>;
export type Meta = { templateName?: string; clientName: string; label?: string };
export type Prompt = { mode: 'name' | 'addItem' | 'createClient'; error?: string };
// In a NEW (not-yet-saved) set the rows are in-memory only: `tempId` is a client-side key
// used by the entry hook and to map entered values back to items at create time.
type NewItemDesc = { tempId: string; key: string; position: number; unit: string };

let tempIdSeq = 0;
const makeTempId = () => `tmp-${Date.now().toString(36)}-${tempIdSeq++}`;

/**
 * All data + persistence logic for the measurement-entry hero: loads the set (re-measure)
 * or seeds from a template in memory (new), and owns saving, naming, the add-item /
 * create-client prompts, and the template swap. View concerns (the scrolling list and its
 * auto-scroll bookkeeping) live in the components, not here.
 */
export function useEntrySession(route: Props['route'], navigation: Props['navigation']) {
  const params = route.params;
  // Re-measure: an existing set. New: a templateId (+ optional clientId for client-first).
  const existingSetId = 'setId' in params ? params.setId : undefined;
  const templateId = 'templateId' in params ? params.templateId : undefined;
  const clientIdParam = 'clientId' in params ? params.clientId : undefined;
  const labelParam = 'label' in params ? params.label : undefined;
  const isNew = existingSetId == null;

  const [loading, setLoading] = useState(true);
  // The set's client. Starts from the route (client-first) or undefined (measure-first);
  // the tailor can create/attach a client mid-session (see submitCreateClient), which sets
  // this so the eventual save goes client-first instead of prompting for a name.
  const [clientId, setClientId] = useState(clientIdParam);
  const [seed, setSeed] = useState<EntrySeed[]>([]);
  // New-mode item descriptors (parallel to `seed`); used to create rows on save.
  const [descriptors, setDescriptors] = useState<NewItemDesc[]>([]);
  const [meta, setMeta] = useState<Meta>({ clientName: '' });
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [templatePicker, setTemplatePicker] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);

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
  // Every item filled and nothing mid-entry (dock.placeholder = not typing) → the dock's
  // Next becomes Save. While typing, stay Next so the buffer commits first.
  const saveMode = entry.total > 0 && entry.filled === entry.total && entry.dock.placeholder;

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
        if (clientId) {
          // client known (chosen up front or created mid-session): write the set now
          await createSetWithMeasurements(database, {
            templateId: templateId!,
            clientId,
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
    [isNew, clientId, templateId, labelParam, existingSetId, navigation, buildNewItems],
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

  // Create/attach the client up front (measure-first), before the measurements are saved.
  // This persists a name-only client (like "Add client") and flips the session to
  // client-first, so the eventual save writes the set straight against it.
  const submitCreateClient = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      setPrompt({ mode: 'createClient', error: 'Enter a name.' });
      return;
    }
    try {
      const client = await createClient(database, { name: trimmed });
      setClientId(client.id);
      setMeta((m) => ({ ...m, clientName: client.name }));
      setPrompt(null);
    } catch (e) {
      if (e instanceof DuplicateClientNameError) {
        setPrompt({ mode: 'createClient', error: e.message });
      } else {
        setPrompt(null);
        Alert.alert('Could not create client', e instanceof Error ? e.message : String(e));
      }
    }
  }, []);

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

  // Swap the template mid-creation (new sets only). Replacing the route remounts the hero
  // on a clean slate from the new template — simpler and safer than re-seeding in place.
  const openTemplatePicker = useCallback(async () => {
    setTemplates(await listTemplates(database));
    setTemplatePicker(true);
  }, []);

  const switchTemplate = useCallback(
    (id: string) => {
      setTemplatePicker(false);
      if (id === templateId) return;
      const go = () =>
        navigation.replace('MeasurementEntry', {
          templateId: id,
          clientId, // carry a client created/chosen this session across the remount
          label: labelParam,
        });
      if (entry.filled > 0) {
        Alert.alert('Switch template?', "This clears the measurements you've entered so far.", [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Switch', style: 'destructive', onPress: go },
        ]);
      } else {
        go();
      }
    },
    [templateId, clientId, labelParam, navigation, entry],
  );

  const onBack = useCallback(() => navigation.goBack(), [navigation]);
  const openCreateClient = useCallback(() => setPrompt({ mode: 'createClient' }), []);
  const openAddItem = useCallback(() => setPrompt({ mode: 'addItem' }), []);
  const closePrompt = useCallback(() => setPrompt(null), []);
  const closeTemplatePicker = useCallback(() => setTemplatePicker(false), []);

  return {
    loading,
    isNew,
    isDraft,
    meta,
    saveMode,
    entry,
    templateId,
    templates,
    templatePicker,
    prompt,
    onBack,
    onSave,
    openCreateClient,
    openAddItem,
    closePrompt,
    submitName,
    submitAddItem,
    submitCreateClient,
    openTemplatePicker,
    switchTemplate,
    closeTemplatePicker,
  };
}
