import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '@/theme/tokens';
import { Dock } from '@/components/Dock';
import { EntryTopBar, EntryHeader, EntryList, EntryPrompts } from '@/components/measurement';
import { ItemPickerSheet } from '@/components/templates';
import { CoachMark, useCoachMark } from '@/components/CoachMark';
import type { RootStackParamList } from '@/navigation/types';
import { useEntrySession } from './useEntrySession';

type Props = NativeStackScreenProps<RootStackParamList, 'MeasurementEntry'>;

/**
 * The hero. Mirrors the paper card: scrollable item list + docked thumb-zone input.
 * No note/photo controls here, no bottom tabs (it's a stack route outside the tabs).
 * Data + persistence live in `useEntrySession`; the pieces are presentational components.
 */
export default function MeasurementEntryScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const s = useEntrySession(route, navigation);
  // Shown once, after the list loads: the core measuring gestures aren't self-evident.
  const coach = useCoachMark('entry-basics', !s.loading);

  if (s.loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <EntryTopBar
        isNew={s.isNew}
        templateName={s.meta.templateName}
        onBack={s.onBack}
        onSave={s.onSave}
        onSwapTemplate={s.openTemplatePicker}
        topInset={insets.top}
      />

      <EntryHeader
        isDraft={s.isDraft}
        clientName={s.meta.clientName}
        label={s.meta.label}
        filled={s.entry.filled}
        total={s.entry.total}
        onAddClient={s.openCreateClient}
      />

      <EntryList
        rows={s.entry.rows}
        active={s.entry.active}
        dockDisplay={s.entry.dock.display}
        dockPlaceholder={s.entry.dock.placeholder}
        onTapRow={s.entry.tapRow}
        onAddItem={s.openAddItem}
      />

      {/* docked input — the bottom-right action becomes Save once every item is filled
          and nothing is mid-entry (typing a value keeps it Next so the buffer commits). */}
      <View style={{ backgroundColor: colors.dockBg }}>
        <Dock
          frac={s.entry.dock.frac}
          onFrac={s.entry.setFrac}
          onDigit={s.entry.press}
          onDelete={s.entry.del}
          onNext={s.saveMode ? s.onSave : s.entry.commitNext}
          saveMode={s.saveMode}
        />
        <View style={{ height: insets.bottom }} />
      </View>

      <EntryPrompts
        prompt={s.prompt}
        onCancel={s.closePrompt}
        onSubmitName={s.submitName}
        onSubmitAddItem={s.submitAddItem}
        onSubmitCreateClient={s.submitCreateClient}
      />

      <ItemPickerSheet
        visible={s.templatePicker}
        options={s.templates.map((t) => ({ id: t.id, name: t.name }))}
        currentId={s.templateId}
        onSelect={s.switchTemplate}
        onClose={s.closeTemplatePicker}
        bottomInset={insets.bottom}
      />

      <CoachMark
        visible={coach.visible}
        onDismiss={coach.dismiss}
        placement="center"
        title="Measuring, the fast way"
        lines={[
          'Tap any row to jump straight to it — fill in any order.',
          'Type inches → tap ¼ ½ ¾ → Next. It auto-advances to the next empty row.',
          'No client yet? Just measure and add the name when you Save.',
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
});
