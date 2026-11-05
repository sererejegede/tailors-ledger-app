import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '@/theme/tokens';
import { Dock } from '@/components/Dock';
import { ScreenHeader } from '@/components/ui';
import { EntryContext, EntryList, EntryPrompts } from '@/components/measurement';
import { ItemPickerSheet } from '@/components/templates';
import type { RootStackParamList } from '@/navigation/types';
import { useEntrySession } from './useEntrySession';

type Props = NativeStackScreenProps<RootStackParamList, 'MeasurementEntry'>;

/**
 * The hero (S5). Mirrors the paper card: Back and the title on top; the client, template
 * and label buttons under it; the scrollable item list; and the docked thumb-zone input,
 * whose top line holds the filled count and Save set. No note/photo controls here, no
 * bottom tabs (it's a stack route outside the tabs). Data + persistence live in
 * `useEntrySession`; the pieces are presentational components.
 */
export default function MeasurementEntryScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const s = useEntrySession(route, navigation);

  if (s.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title={s.isNew ? 'New measurement' : 'Re-measure'} onBack={s.onBack} />

      <EntryContext
        isDraft={s.isDraft}
        clientName={s.meta.clientName}
        canSwapTemplate={s.isNew}
        templateName={s.meta.templateName}
        label={s.meta.label}
        onAddClient={s.openCreateClient}
        onSwapTemplate={s.openTemplatePicker}
        onLabel={s.openLabel}
      />

      <EntryList
        rows={s.entry.rows}
        active={s.entry.active}
        dockDisplay={s.entry.dock.display}
        dockPlaceholder={s.entry.dock.placeholder}
        onTapRow={s.entry.tapRow}
        onAddItem={s.openAddItem}
      />

      <View style={{ backgroundColor: colors.dockBg }}>
        <Dock
          frac={s.entry.dock.frac}
          filled={s.entry.filled}
          total={s.entry.total}
          onFrac={s.entry.setFrac}
          onDigit={s.entry.press}
          onDelete={s.entry.del}
          onNext={s.entry.commitNext}
          onSave={s.onSave}
        />
        <View style={{ height: insets.bottom }} />
      </View>

      <EntryPrompts
        prompt={s.prompt}
        label={s.meta.label}
        onCancel={s.closePrompt}
        onSubmitName={s.submitName}
        onSubmitAddItem={s.submitAddItem}
        onSubmitCreateClient={s.submitCreateClient}
        onSubmitLabel={s.submitLabel}
      />

      <ItemPickerSheet
        visible={s.templatePicker}
        options={s.templates.map((t) => ({ id: t.id, name: t.name }))}
        currentId={s.templateId}
        onSelect={s.switchTemplate}
        onClose={s.closeTemplatePicker}
        bottomInset={insets.bottom}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
});
