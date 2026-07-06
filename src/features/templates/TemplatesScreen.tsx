import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { database } from '@/db';
import type Template from '@/db/models/Template';
import { listTemplates, templateItems } from '@/repositories/templates';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import ChevronIcon from '@/assets/icons/chevron-right.svg';
import type { RootStackParamList } from '@/navigation/types';
import { FloatingActionButton } from '@/components/FloatingActionButton';

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

  // Open the editor in "new" mode — nothing is written until it has a name + ≥1 item.
  const newTemplate = useCallback(() => {
    navigation.navigate('TemplateEditor', {});
  }, [navigation]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.md }]}>
      <Text style={styles.h1}>Templates</Text>
      <Text style={styles.intro}>Templates are used to create measurement sets. You can create a new template by tapping the plus button below.</Text>

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
      <FloatingActionButton
        onPress={newTemplate}
        accessibilityLabel="New template"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.md, minHeight: '100%' },
  h1: { fontFamily: fonts.title, fontSize: fontSizes['3xl'], color: colors.text },
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
  name: { fontFamily: fonts.semibold, fontSize: fontSizes.lg, color: colors.text },
  badge: {
    fontFamily: fonts.bold,
    fontSize: fontSizes.xxs,
    letterSpacing: 0.5,
    color: colors.accent,
    backgroundColor: colors.accentTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
  intro: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.muted, marginBlock: space.md },
});
