import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, fontSizes, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { DraggableTemplateItems, TemplateItemEditor } from '@/components/templates';
import {
  BottomBar,
  Button,
  CheckRow,
  Field,
  ScreenHeader,
  SectionLabel,
  Tag,
  TextAction,
  useKeyboardHeight,
} from '@/components/ui';
import type { RootStackParamList } from '@/navigation/types';
import PlusIcon from '@/assets/icons/plus.svg';
import { useTemplateEditor } from './useTemplateEditor';

type Props = NativeStackScreenProps<RootStackParamList, 'TemplateEditor'>;

/**
 * S13. The template's name, "Use as default?" (or a DEFAULT tag once it is), then every
 * item with a ⋮⋮ handle to drag it to a new place and "+ Add item" last. Tapping an item
 * opens it in a sheet (rename, range, delete). A saved template changes as you go; a new
 * one is held in memory until *Save template* (lazy create).
 */
export default function TemplateEditorScreen({ route, navigation }: Props) {
  const s = useTemplateEditor(route, navigation);
  const keyboard = useKeyboardHeight();
  // Defer mounting the rows' drag handlers until the open animation finishes, so the screen
  // transition doesn't stutter. `transitionEnd` is the reliable signal (InteractionManager
  // is deprecated in RN 0.85); a timeout covers the case where the event is missed.
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    const unsub = navigation.addListener('transitionEnd', (e) => {
      if (!e.data.closing) setInteractive(true);
    });
    const fallback = setTimeout(() => setInteractive(true), 450);
    return () => {
      unsub();
      clearTimeout(fallback);
    };
  }, [navigation]);

  const title = s.isNew ? s.name.trim() || 'New template' : s.name.trim() || 'Template';
  const count = s.items.length;
  // A saved default shows a DEFAULT tag where the checkbox would be, so nothing shifts when
  // it's ticked. One template is always the default, so it stops being one only when another
  // is chosen. A new template keeps its checkbox until it's saved, so the choice can be undone.
  const savedDefault = s.isDefault && !s.isNew;

  return (
    <View style={[styles.screen, s.isNew ? { paddingBottom: keyboard } : null]}>
      <ScreenHeader title={title} />
      {s.ready ? (
        <ScrollView
          contentContainerStyle={[styles.content, s.isNew ? null : { paddingBottom: keyboard + space.xxl }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.nameField}>
            <Field
              label="Name"
              value={s.name}
              onChangeText={s.setName}
              onBlur={s.saveName}
              placeholder="e.g. Men's"
              autoCapitalize="words"
              returnKeyType="done"
            />
          </View>
          {savedDefault ? (
            <View style={styles.defaultRow}>
              <Tag label="Default" />
            </View>
          ) : (
            <CheckRow title="Use as default?" checked={s.isDefault} onChange={s.setDefault} />
          )}

          <SectionLabel title={`Items · ${count}`} aside={count > 1 ? 'Drag ⋮⋮ to reorder' : undefined} />
          {count > 0 ? (
            <DraggableTemplateItems
              items={s.items}
              onReorder={s.reorder}
              onEdit={s.openEditItem}
              interactive={interactive}
            />
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.add, pressed && styles.pressed]}
            onPress={s.openAddItem}
            accessibilityRole="button"
          >
            <PlusIcon width={18} height={18} color={colors.accent} />
            <Text style={styles.addText}>Add item</Text>
          </Pressable>

          <Text style={styles.note}>
            {count === 0
              ? 'Add the measurements a new set starts with, in the order you take them.'
              : `Every item is shown, so you can drag any of them to a new place.${
                  s.isNew ? '' : ' Changes are saved automatically.'
                } Tap an item to rename it, set its range or delete it.`}
          </Text>

          {s.isNew ? null : <TextAction label="Delete this template" danger onPress={s.removeTemplate} />}
        </ScrollView>
      ) : null}

      {s.isNew ? (
        <BottomBar>
          <Button kind="primary" label="Save template" onPress={s.saveNewTemplate} />
        </BottomBar>
      ) : null}

      <TemplateItemEditor
        draft={s.draft}
        onChange={s.updateDraft}
        onCancel={s.closeDraft}
        onSave={s.saveDraft}
        onDelete={s.deleteDraftItem}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  nameField: { marginTop: -14 },
  // Same height and line as the "Use as default?" row it takes the place of.
  defaultRow: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 52,
    paddingLeft: 42,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: { opacity: 0.6 },
  addText: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.accent },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: space.sm },
});
