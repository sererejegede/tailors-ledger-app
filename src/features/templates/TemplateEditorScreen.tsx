import { useCallback, useLayoutEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
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
  createTemplateWithItems,
  DuplicateTemplateNameError,
} from '@/repositories/templates';
import { Tables } from '@/db/schema';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'TemplateEditor'>;
type ItemDraft = { id?: string; key: string; min: string; max: string } | null;
// Unified item shape for both modes: `id` is the DB id (existing) or a client-side temp id
// (new, in-memory until the template is saved).
type EditItem = { id: string; key: string; minRange?: number; maxRange?: number };

let tplItemSeq = 0;
const makeItemId = () => `tmp-${tplItemSeq++}`;

export default function TemplateEditorScreen({ route, navigation }: Props) {
  const templateId = route.params.templateId;
  const isNew = templateId == null;
  const [template, setTemplate] = useState<Template | null>(null);
  const [items, setItems] = useState<EditItem[]>([]);
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<ItemDraft>(null);
  // New templates are in memory until save; this holds the would-be default flag.
  const [isDefaultLocal, setIsDefaultLocal] = useState(false);
  const isDefault = isNew ? isDefaultLocal : !!template?.isDefault;

  const load = useCallback(async () => {
    if (!templateId) return; // new template — nothing persisted to load
    const t = await database.get<Template>(Tables.templates).find(templateId);
    setTemplate(t);
    setName(t.name);
    const rows = await templateItems(database, templateId);
    setItems(rows.map((it) => ({ id: it.id, key: it.key, minRange: it.minRange ?? undefined, maxRange: it.maxRange ?? undefined })));
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

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isNew ? 'New template' : 'Edit template',
      headerRight: isNew
        ? () => (
            <Pressable onPress={saveNewTemplate} hitSlop={8}>
              <Text style={styles.headerSave}>Save</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, isNew, saveNewTemplate]);

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

  const move = useCallback(
    async (index: number, dir: -1 | 1) => {
      const target = index + dir;
      if (target < 0 || target >= items.length) return;
      const swapped = [...items];
      [swapped[index], swapped[target]] = [swapped[target], swapped[index]];
      if (isNew) {
        setItems(swapped);
        return;
      }
      await reorderTemplateItems(database, swapped.map((it) => it.id));
      load();
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
    (item: EditItem) => {
      Alert.alert('Remove item', `Remove “${item.key}” from this template?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (isNew) {
              setItems((prev) => prev.filter((it) => it.id !== item.id));
              return;
            }
            await softDeleteTemplateItem(database, item.id);
            load();
          },
        },
      ]);
    },
    [isNew, load],
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

  if (!isNew && !template) return <View style={styles.screen} />;

  const rangeLabel = (it: EditItem) => {
    if (it.minRange != null && it.maxRange != null) return `${it.minRange}–${it.maxRange}″`;
    if (it.minRange != null) return `≥ ${it.minRange}″`;
    if (it.maxRange != null) return `≤ ${it.maxRange}″`;
    return 'no range';
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={setName}
        onBlur={saveName}
        placeholder="Template name"
        placeholderTextColor={colors.faint}
      />

      <View style={styles.defaultRow}>
        {isDefault ? (
          <Text style={styles.defaultBadge}>DEFAULT</Text>
        ) : (
          <Pressable style={styles.makeDefault} onPress={makeDefault}>
            <Text style={styles.makeDefaultText}>Set as default</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.itemsHeader}>
        <Text style={styles.section}>Items</Text>
        <Pressable onPress={() => setDraft({ key: '', min: '', max: '' })}>
          <Text style={styles.add}>＋ Add item</Text>
        </Pressable>
      </View>

      {items.length === 0 ? (
        <Text style={styles.empty}>No items yet — add at least one to save this template.</Text>
      ) : (
        <View style={styles.card}>
          {items.map((it, i) => (
            <View key={it.id} style={[styles.itemRow, i === items.length - 1 && styles.itemRowLast]}>
              <Pressable
                style={{ flex: 1 }}
                onPress={() =>
                  setDraft({
                    id: it.id,
                    key: it.key,
                    min: it.minRange?.toString() ?? '',
                    max: it.maxRange?.toString() ?? '',
                  })
                }
              >
                <Text style={styles.itemKey}>{it.key}</Text>
                <Text style={styles.itemRange}>{rangeLabel(it)}</Text>
              </Pressable>
              <View style={styles.controls}>
                <Pressable onPress={() => move(i, -1)} hitSlop={8} disabled={i === 0}>
                  <Text style={[styles.ctrl, i === 0 && styles.ctrlOff]}>↑</Text>
                </Pressable>
                <Pressable onPress={() => move(i, 1)} hitSlop={8} disabled={i === items.length - 1}>
                  <Text style={[styles.ctrl, i === items.length - 1 && styles.ctrlOff]}>↓</Text>
                </Pressable>
                <Pressable onPress={() => removeItem(it)} hitSlop={8}>
                  <Text style={styles.ctrlDelete}>✕</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}

      {isNew ? null : (
        <Pressable style={styles.deleteTemplate} onPress={removeTemplate}>
          <Text style={styles.deleteText}>Delete template</Text>
        </Pressable>
      )}

      {/* item editor */}
      <Modal visible={draft != null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDraft(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.backdrop}>
          <Pressable style={styles.backdropFill} onPress={() => setDraft(null)} />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{draft?.id ? 'Edit item' : 'Add item'}</Text>
            <TextInput
              style={styles.modalInput}
              value={draft?.key}
              onChangeText={(t) => setDraft((d) => (d ? { ...d, key: t } : d))}
              placeholder="Item name (e.g. Sleeve length)"
              placeholderTextColor={colors.faint}
              autoFocus
            />
            <View style={styles.rangeInputs}>
              <TextInput
                style={[styles.modalInput, styles.rangeInput]}
                value={draft?.min}
                onChangeText={(t) => setDraft((d) => (d ? { ...d, min: t } : d))}
                placeholder="min"
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
              />
              <Text style={styles.dash}>–</Text>
              <TextInput
                style={[styles.modalInput, styles.rangeInput]}
                value={draft?.max}
                onChangeText={(t) => setDraft((d) => (d ? { ...d, max: t } : d))}
                placeholder="max"
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.modalBtns}>
              <Pressable style={[styles.modalBtn, styles.cancel]} onPress={() => setDraft(null)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.go]} onPress={saveDraft}>
                <Text style={styles.goText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.sm },
  fieldLabel: { fontFamily: fonts.medium, fontSize: 13, color: colors.muted },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.semibold,
    fontSize: 18,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  headerSave: { fontFamily: fonts.bold, fontSize: 16, color: colors.accent },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  defaultText: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  defaultBadge: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.accent,
    backgroundColor: colors.accentTint,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  makeDefault: { flexDirection: 'row', flex: 1, justifyContent: 'flex-end', paddingBlock: space.sm },
  makeDefaultText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accent },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  section: { fontFamily: fonts.titleSemi, fontSize: 18, color: colors.text },
  add: { fontFamily: fonts.semibold, fontSize: 14, color: colors.accent },
  empty: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, paddingVertical: space.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  itemRowLast: { borderBottomWidth: 0 },
  itemKey: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  itemRange: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ctrl: { fontSize: 20, color: colors.muted, width: 22, textAlign: 'center' },
  ctrlOff: { color: colors.line2 },
  ctrlDelete: { fontSize: 16, color: colors.danger, width: 22, textAlign: 'center' },
  deleteTemplate: { alignSelf: 'center', paddingVertical: space.lg, marginTop: space.md },
  deleteText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.danger },
  // modal
  backdrop: { flex: 1, justifyContent: 'center', padding: space.xl },
  backdropFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(27,26,23,0.45)' },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.default, padding: space.lg, gap: space.sm },
  modalTitle: { fontFamily: fonts.title, fontSize: 20, color: colors.text },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.default,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
  },
  rangeInputs: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  rangeInput: { flex: 1 },
  dash: { fontFamily: fonts.body, fontSize: 18, color: colors.muted },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
  modalBtn: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.default },
  cancel: { backgroundColor: colors.bg },
  cancelText: { fontFamily: fonts.semibold, color: colors.muted },
  go: { backgroundColor: colors.accent },
  goText: { fontFamily: fonts.semibold, color: '#fff' },
});
