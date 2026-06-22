import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { database } from '@/db';
import type Template from '@/db/models/Template';
import { listTemplates, templateItems, createTemplate } from '@/repositories/templates';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import ChevronIcon from '@/assets/icons/chevron-right.svg';
import type { RootStackParamList } from '@/navigation/types';

type Row = { template: Template; count: number };

export default function TemplatesScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const templates = await listTemplates(database);
    const counts = await Promise.all(templates.map((t) => templateItems(database, t.id)));
    setRows(templates.map((template, i) => ({ template, count: counts[i].length })));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const newTemplate = useCallback(async () => {
    const t = await createTemplate(database, { name: 'New template' });
    navigation.navigate('TemplateEditor', { templateId: t.id });
  }, [navigation]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}>
      <Text style={styles.h1}>Templates</Text>

      <Pressable style={styles.new} onPress={newTemplate}>
        <Text style={styles.newText}>＋ New template</Text>
      </Pressable>

      <View style={styles.card}>
        {rows.map(({ template, count }, i) => (
          <Pressable
            key={template.id}
            style={[styles.row, i === rows.length - 1 && styles.rowLast]}
            onPress={() => navigation.navigate('TemplateEditor', { templateId: template.id })}
          >
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{template.name}</Text>
                {template.isDefault ? <Text style={styles.badge}>DEFAULT</Text> : null}
              </View>
              <Text style={styles.meta}>{count} items</Text>
            </View>
            <ChevronIcon width={20} height={20} color={colors.faint} />
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md },
  h1: { fontFamily: fonts.title, fontSize: 28, color: colors.text },
  new: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.default,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  newText: { fontFamily: fonts.bold, fontSize: 15, color: colors.accent },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { fontFamily: fonts.semibold, fontSize: 17, color: colors.text },
  badge: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: colors.accent,
    backgroundColor: colors.accentTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
});
