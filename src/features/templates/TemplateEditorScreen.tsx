import { useLayoutEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { TemplateItemRow, TemplateItemEditor } from '@/components/templates';
import type { RootStackParamList } from '@/navigation/types';
import { useTemplateEditor } from './useTemplateEditor';
import { FloatingActionButton } from '@/components/FloatingActionButton';

type Props = NativeStackScreenProps<RootStackParamList, 'TemplateEditor'>;

export default function TemplateEditorScreen({ route, navigation }: Props) {
  const s = useTemplateEditor(route, navigation);

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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.fieldLabel}>Name</Text>
      <TextInput
        style={styles.nameInput}
        value={s.name}
        onChangeText={s.setName}
        onBlur={s.saveName}
        placeholder="Template name"
        placeholderTextColor={colors.faint}
      />

      <View style={styles.defaultRow}>
        {s.isDefault ? (
          <Text style={styles.defaultBadge}>DEFAULT</Text>
        ) : (
          <Pressable style={styles.makeDefault} onPress={s.makeDefault}>
            <Text style={styles.makeDefaultText}>Set as default</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.itemsHeader}>
        <Text style={styles.section}>Items</Text>
      </View>

      {s.items.length === 0 ? (
        <Text style={styles.empty}>No items yet — add at least one to save this template.</Text>
      ) : (
        <View style={styles.card}>
          {s.items.map((it, i) => (
            <TemplateItemRow
              key={it.id}
              item={it}
              isFirst={i === 0}
              isLast={i === s.items.length - 1}
              onEdit={() => s.openEditItem(it)}
              onMoveUp={() => s.move(i, -1)}
              onMoveDown={() => s.move(i, 1)}
              onRemove={() => s.removeItem(it)}
            />
          ))}
        </View>
      )}

      {s.isNew ? null : (
        <Pressable style={styles.deleteTemplate} onPress={s.removeTemplate}>
          <Text style={styles.deleteText}>Delete template</Text>
        </Pressable>
      )}

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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.sm, minHeight: '100%' },
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
  makeDefault: { flexDirection: 'row', flex: 1, justifyContent: 'flex-end', paddingVertical: space.sm },
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
  deleteTemplate: { alignSelf: 'center', paddingVertical: space.lg, marginTop: space.md },
  deleteText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.danger },
});
