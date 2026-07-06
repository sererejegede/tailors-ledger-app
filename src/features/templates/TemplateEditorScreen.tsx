import { useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { DraggableTemplateItems, TemplateItemEditor } from '@/components/templates';
import type { RootStackParamList } from '@/navigation/types';
import { useTemplateEditor } from './useTemplateEditor';
import { FloatingActionButton } from '@/components/FloatingActionButton';
import { CoachMark, useCoachMark } from '@/components/CoachMark';

type Props = NativeStackScreenProps<RootStackParamList, 'TemplateEditor'>;

export default function TemplateEditorScreen({ route, navigation }: Props) {
  const s = useTemplateEditor(route, navigation);
  // Defer mounting the rows' gesture handlers until the open animation finishes, so the
  // screen transition doesn't stutter while Swipeable/drag set up native handlers.
  // `transitionEnd` is the reliable signal (InteractionManager is deprecated in RN 0.85
  // and resolves too early); a timeout covers the case where the event is missed.
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

  // First visit (once the rows are interactive and there's something to act on): teach the
  // hidden swipe/drag gestures and nudge the top row's swipe action open.
  const coach = useCoachMark('tpl-editor-gestures', interactive && s.items.length > 0);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: s.isNew ? 'New template' : 'Edit template',
      headerRight: s.isNew
        ? () => (
            <Pressable onPress={s.saveNewTemplate} hitSlop={8}>
              <Text style={styles.headerSave}>Save</Text>
            </Pressable>
          )
        : undefined,
    });
  }, [navigation, s.isNew, s.saveNewTemplate]);

  if (!s.ready) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <ScrollView>
        <View style={styles.defaultRow}>
          <Text style={styles.fieldLabel}>Name</Text>
          {s.isDefault ? <Text style={styles.defaultBadge}>DEFAULT</Text> : <Pressable style={styles.makeDefault} onPress={s.makeDefault}>
            <Text style={styles.makeDefaultText}>Set as default</Text>
          </Pressable>}
        </View>
        
        <TextInput
          style={styles.nameInput}
          value={s.name}
          onChangeText={s.setName}
          onBlur={s.saveName}
          placeholder="Template name"
          placeholderTextColor={colors.faint}
        />

        {s.items.length === 0 ? (
          <Text style={styles.empty}>No items yet — add at least one to save this template.</Text>
        ) : (
          <DraggableTemplateItems
            items={s.items}
            onReorder={s.reorder}
            onEdit={s.openEditItem}
            onRemove={s.removeItem}
            interactive={interactive}
            nudgeFirst={coach.visible}
          />
        )}

        {s.isNew ? null : (
          <Pressable style={styles.deleteTemplate} onPress={s.removeTemplate}>
            <Text style={styles.deleteText}>Delete template</Text>
          </Pressable>
        )}
      </ScrollView>
      
      <FloatingActionButton
        onPress={s.openAddItem}
        accessibilityLabel="Add item"
      />

      <TemplateItemEditor
        draft={s.draft}
        onChange={s.updateDraft}
        onCancel={s.closeDraft}
        onSave={s.saveDraft}
      />

      <CoachMark
        visible={coach.visible}
        onDismiss={coach.dismiss}
        placement="center"
        title="Manage template items"
        lines={[
          'Swipe a row left to delete it.',
          'Drag the ☰ handle to reorder.',
          'Tap a row to edit its name or range.',
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  fieldLabel: {
    fontFamily: fonts.medium,
    fontSize: fontSizes.sm,
    color: colors.muted,
    marginBlock: space.sm
  },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.semibold,
    fontSize: fontSizes.lg,
    color: colors.text,
    backgroundColor: colors.surface,
    marginBlockEnd: space.xxl,
  },
  headerSave: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.accent },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  defaultBadge: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxs,
    letterSpacing: 0.5,
    color: colors.accent,
    backgroundColor: colors.accentTint,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  makeDefault: { flexDirection: 'row', flex: 1, justifyContent: 'flex-end', paddingVertical: space.sm },
  makeDefaultText: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.sm,
    color: colors.accent,
  },
  section: { fontFamily: fonts.titleSemi, fontSize: fontSizes.lg, color: colors.text },
  add: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.accent },
  empty: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, paddingVertical: space.sm },
  deleteTemplate: { alignSelf: 'center', paddingTop: space.lg, marginBlockEnd: 96, marginBlockStart: 'auto' },
  deleteText: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.danger },
});
