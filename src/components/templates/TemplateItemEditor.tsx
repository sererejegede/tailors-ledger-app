import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { Portal } from '@/components/OverlayHost';
import type { ItemDraft } from '@/features/templates/useTemplateEditor';

/**
 * Add/edit a template item (key + optional min/max range). Rendered through the app-root
 * Portal rather than a native Modal — the same reasons as PromptModal: a Modal's Dialog
 * window eats the first tap while the keyboard is up, and an in-tree overlay doesn't.
 */
type Props = {
  draft: ItemDraft | null;
  onChange: (patch: Partial<ItemDraft>) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function TemplateItemEditor({ draft, onChange, onCancel, onSave }: Props) {
  const visible = draft != null;
  const [kbHeight, setKbHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onCancel();
      return true;
    });
    return () => {
      show.remove();
      hide.remove();
      back.remove();
      clearTimeout(t);
    };
  }, [visible, onCancel]);

  if (!draft) return null;

  // Closing always dismisses the keyboard too (the Name field behind the overlay can
  // otherwise re-grab focus and keep it up). Tapping the backdrop closes, same as Cancel.
  const close = () => {
    Keyboard.dismiss();
    onCancel();
  };

  return (
    <Portal>
      <View style={styles.overlay}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scroll, { paddingBottom: kbHeight }]}
          keyboardShouldPersistTaps="always"
        >
          <Pressable style={styles.backdropFill} onPress={close} />
          <View style={styles.card}>
            <Text style={styles.title}>{draft.id ? 'Edit item' : 'Add item'}</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={draft.key}
              onChangeText={(t) => onChange({ key: t })}
              placeholder="Item name (e.g. Sleeve length)"
              placeholderTextColor={colors.faint}
              autoCorrect={false}
            />
            <View style={styles.rangeInputs}>
              <TextInput
                style={[styles.input, styles.rangeInput]}
                value={draft.min}
                onChangeText={(t) => onChange({ min: t })}
                placeholder="min"
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
              />
              <Text style={styles.dash}>–</Text>
              <TextInput
                style={[styles.input, styles.rangeInput]}
                value={draft.max}
                onChangeText={(t) => onChange({ max: t })}
                placeholder="max"
                placeholderTextColor={colors.faint}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.btns}>
              <Pressable style={[styles.btn, styles.cancel]} onPress={close}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.go]} onPress={onSave}>
                <Text style={styles.goText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: space.xl },
  backdropFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(27,26,23,0.45)',
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.default, padding: space.lg, gap: space.sm },
  title: { fontFamily: fonts.title, fontSize: 20, color: colors.text },
  input: {
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
  btns: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
  btn: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.default },
  cancel: { backgroundColor: colors.bg },
  cancelText: { fontFamily: fonts.semibold, color: colors.muted },
  go: { backgroundColor: colors.accent },
  goText: { fontFamily: fonts.semibold, color: '#fff' },
});
