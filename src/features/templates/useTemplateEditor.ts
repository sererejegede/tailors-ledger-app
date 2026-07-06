import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Alert } from '@/lib/alert';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import { Tables } from '@/db/schema';
import type Template from '@/db/models/Template';
import {
  templateItems,
  updateTemplate,
  setDefaultTemplate,
  addTemplateItem,
  updateTemplateItem,
  reorderTemplateItems,
  softDeleteTemplate,
  softDeleteTemplateItem,
  restoreTemplateItem,
  createTemplateWithItems,
  DuplicateTemplateNameError,
} from '@/repositories/templates';
import { useSnackbar } from '@/components/Snackbar';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TemplateEditor'>;
export type ItemDraft = { id?: string; key: string; min: string; max: string };
// Unified item shape for both modes: `id` is the DB id (existing) or a client-side temp id
// (new, in-memory until the template is saved).
export type EditItem = { id: string; key: string; minRange?: number; maxRange?: number };

let tplItemSeq = 0;
const makeItemId = () => `tmp-${tplItemSeq++}`;

/**
 * Template editor logic for both modes (decided by whether the route carries a templateId):
 *  - existing: edits persist live (rename, reorder, add/remove items, set default, delete).
 *  - new: name, items, and the default flag are held in memory and written together only on
 *    save, once there's a name + at least one item (lazy create — no empty "New template").
 */
export function useTemplateEditor(route: Props['route'], navigation: Props['navigation']) {
  const { showSnackbar } = useSnackbar();
  const templateId = route.params.templateId;
  const isNew = templateId == null;
  const [template, setTemplate] = useState<Template | null>(null);
  const [items, setItems] = useState<EditItem[]>([]);
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  // New templates are in memory until save; this holds the would-be default flag.
  const [isDefaultLocal, setIsDefaultLocal] = useState(false);
  const isDefault = isNew ? isDefaultLocal : !!template?.isDefault;

  const load = useCallback(async () => {
    if (!templateId) return; // new template — nothing persisted to load
    const t = await database.get<Template>(Tables.templates).find(templateId);
    setTemplate(t);
    setName(t.name);
    const rows = await templateItems(database, templateId);
    setItems(
      rows.map((it) => ({
        id: it.id,
        key: it.key,
        minRange: it.minRange ?? undefined,
        maxRange: it.maxRange ?? undefined,
      })),
    );
  }, [templateId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Persist a brand-new template only when it has a name AND at least one item.
  const saveNewTemplate = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give the template a name first.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Add an item', 'A template needs at least one item before it can be saved.');
      return;
    }
    try {
      const t = await createTemplateWithItems(database, {
        name: trimmed,
        items: items.map((it) => ({ key: it.key, minRange: it.minRange, maxRange: it.maxRange })),
      });
      if (isDefaultLocal) await setDefaultTemplate(database, t.id);
      navigation.goBack();
    } catch (e) {
      if (e instanceof DuplicateTemplateNameError) Alert.alert('Name taken', e.message);
      else Alert.alert('Could not save', e instanceof Error ? e.message : String(e));
    }
  }, [name, items, isDefaultLocal, navigation]);

  const saveName = useCallback(async () => {
    if (isNew) return; // name lives in state until the template is created
    const trimmed = name.trim();
    if (!trimmed || trimmed === template?.name) return;
    try {
      await updateTemplate(database, templateId, { name: trimmed });
    } catch (e) {
      if (e instanceof DuplicateTemplateNameError) {
        Alert.alert('Name taken', e.message);
        setName(template?.name ?? '');
      } else {
        throw e;
      }
    }
  }, [isNew, name, template?.name, templateId]);

  const makeDefault = useCallback(async () => {
    if (isNew) {
      setIsDefaultLocal(true);
      return;
    }
    await setDefaultTemplate(database, templateId);
    load();
  }, [isNew, templateId, load]);

  // Move item from one index to another (drag-reorder). Adjacent moves are just a swap.
  const reorder = useCallback(
    async (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return;
      const next = [...items];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      setItems(next); // optimistic, so the drop lands instantly
      if (!isNew) {
        await reorderTemplateItems(database, next.map((it) => it.id));
        load();
      }
    },
    [isNew, items, load],
  );

  const saveDraft = useCallback(async () => {
    if (!draft) return;
    const key = draft.key.trim();
    if (!key) return;
    const minRange = draft.min.trim() ? parseFloat(draft.min) : undefined;
    const maxRange = draft.max.trim() ? parseFloat(draft.max) : undefined;
    if (isNew) {
      setItems((prev) =>
        draft.id
          ? prev.map((it) => (it.id === draft.id ? { ...it, key, minRange, maxRange } : it))
          : [...prev, { id: makeItemId(), key, minRange, maxRange }],
      );
    } else if (draft.id) {
      await updateTemplateItem(database, draft.id, { key, minRange, maxRange });
      await load();
    } else {
      await addTemplateItem(database, templateId, { key, minRange, maxRange });
      await load();
    }
    setDraft(null);
  }, [draft, isNew, templateId, load]);

  const removeItem = useCallback(
    async (item: EditItem) => {
      if (isNew) {
        const index = items.findIndex((it) => it.id === item.id);
        setItems((prev) => prev.filter((it) => it.id !== item.id));
        showSnackbar({
          message: `Removed “${item.key}”`,
          actionLabel: 'Undo',
          onAction: () =>
            setItems((prev) => {
              if (prev.some((it) => it.id === item.id)) return prev;
              const next = [...prev];
              next.splice(index < 0 ? prev.length : index, 0, item);
              return next;
            }),
        });
        return;
      }
      await softDeleteTemplateItem(database, item.id);
      load();
      showSnackbar({
        message: `Removed “${item.key}”`,
        actionLabel: 'Undo',
        onAction: async () => {
          await restoreTemplateItem(database, item.id);
          load();
        },
      });
    },
    [isNew, items, load, showSnackbar],
  );

  const removeTemplate = useCallback(() => {
    Alert.alert('Delete template', `Delete “${template?.name}”? This can’t be undone here.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await softDeleteTemplate(database, templateId!);
          navigation.goBack();
        },
      },
    ]);
  }, [template?.name, templateId, navigation]);

  const openAddItem = useCallback(() => setDraft({ key: '', min: '', max: '' }), []);
  const openEditItem = useCallback(
    (it: EditItem) =>
      setDraft({ id: it.id, key: it.key, min: it.minRange?.toString() ?? '', max: it.maxRange?.toString() ?? '' }),
    [],
  );
  const updateDraft = useCallback(
    (patch: Partial<ItemDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d)),
    [],
  );
  const closeDraft = useCallback(() => setDraft(null), []);

  return {
    isNew,
    ready: isNew || template != null,
    name,
    setName,
    items,
    isDefault,
    draft,
    saveName,
    makeDefault,
    reorder,
    saveDraft,
    removeItem,
    removeTemplate,
    saveNewTemplate,
    openAddItem,
    openEditItem,
    updateDraft,
    closeDraft,
  };
}
