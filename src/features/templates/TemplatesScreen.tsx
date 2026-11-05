import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { database } from '@/db';
import type Template from '@/db/models/Template';
import { listTemplates, templateItems } from '@/repositories/templates';
import { colors, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import ChevronIcon from '@/assets/icons/chevron-right.svg';
import type { RootStackParamList } from '@/navigation/types';
import { BottomBar, Button, ScreenHeader, Tag } from '@/components/ui';

/** How many item names a row previews before "…". */
const PREVIEW = 3;

type Row = { template: Template; count: number; preview: string };

/** S12. Opens from Settings: every template, and New template at the bottom. */
export default function TemplatesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const templates = await listTemplates(database);
    const items = await Promise.all(templates.map((t) => templateItems(database, t.id)));
    setRows(
      templates.map((template, i) => {
        const keys = items[i].map((it) => it.key);
        const preview = keys.slice(0, PREVIEW).join(', ') + (keys.length > PREVIEW ? '…' : '');
        return { template, count: keys.length, preview };
      }),
    );
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
    <View style={styles.screen}>
      <ScreenHeader title="Templates" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.intro}>The list of measurements a new set starts with.</Text>
        {rows.map(({ template, count, preview }, i) => (
          <Pressable
            key={template.id}
            style={({ pressed }) => [styles.row, i === rows.length - 1 && styles.rowLast, pressed && styles.pressed]}
            onPress={() => navigation.navigate('TemplateEditor', { templateId: template.id })}
            accessibilityRole="button"
            accessibilityLabel={template.name}
          >
            <View style={styles.main}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {template.name}
                </Text>
                {template.isDefault ? <Tag label="Default" /> : null}
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {count} {count === 1 ? 'item' : 'items'}
                {preview ? ` · ${preview}` : ''}
              </Text>
            </View>
            <ChevronIcon width={18} height={18} color={colors.faint} />
          </Pressable>
        ))}
      </ScrollView>
      <BottomBar>
        <Button kind="primary" label="New template" onPress={newTemplate} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl },
  intro: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, marginBottom: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowLast: { borderBottomWidth: 0 },
  pressed: { opacity: 0.6 },
  main: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
});
