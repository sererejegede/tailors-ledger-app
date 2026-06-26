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

/**
 * Minimal single-field prompt (Android has no Alert.prompt). Used to name an unnamed
 * draft and to add an ad-hoc item. Shows an optional inline error (e.g. duplicate name).
 *
 * Implemented as an in-tree overlay, NOT a React Native <Modal>. On Android a <Modal>
 * is a separate native Dialog window, and while the soft keyboard is up that window
 * swallows the first tap to dismiss the keyboard — the touch never reaches the RN view
 * tree, so `keyboardShouldPersistTaps` can't help and buttons need a second tap. An
 * in-tree overlay receives every touch normally, so the keyboard stays up and the
 * press fires on the first tap.
 */
type Props = {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  error?: string;
  multilineInput?: boolean;
  inputMode?: 'email' | 'text' | 'numeric' | 'tel' | 'url' | 'search';
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'url' | 'visible-password';
  onCancel: () => void;
  onSubmit: (value: string) => void;
};

export function PromptModal({
  visible,
  title,
  message,
  placeholder,
  initialValue = '',
  submitLabel = 'Save',
  error,
  multilineInput = false,
  inputMode = 'text',
  keyboardType = 'default',
  onCancel,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);
  // Track the keyboard height ourselves and lift the card by it: nothing resizes the
  // overlay for the keyboard, so pad the centered container to keep the card clear.
  const [kbHeight, setKbHeight] = useState(0);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  useEffect(() => {
    if (!visible) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKbHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKbHeight(0));
    // Focus once we're on screen so the keyboard opens reliably.
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    // Hardware back closes the prompt instead of navigating away (what <Modal> gave us).
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

  if (!visible) return null;

  // Closing always dismisses the keyboard too (an input behind the overlay can otherwise
  // re-grab focus and keep it up). Tapping the backdrop closes, same as Cancel.
  const close = () => {
    Keyboard.dismiss();
    onCancel();
  };

  return (
    <Portal>
      <View style={styles.overlay}>
      {/* keyboardShouldPersistTaps="always": a button tap must not blur the input (which
          would start hiding the keyboard before the, possibly async, action runs). The
          keyboard only dismisses when this overlay unmounts on close.
          paddingBottom = keyboard height lifts the centered card above the keyboard. */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.scroll, { paddingBottom: kbHeight }]}
        keyboardShouldPersistTaps="always"
      >
        <Pressable style={styles.backdropFill} onPress={close} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <TextInput
            ref={inputRef}
            style={[styles.input, error ? styles.inputError : null, { height: multilineInput ? 200 : 'auto' }]}
            textAlignVertical="top"
            placeholder={placeholder}
            placeholderTextColor={colors.faint}
            value={value}
            onChangeText={setValue}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => onSubmit(value)}
            multiline={multilineInput}
            inputMode={inputMode}
            keyboardType={keyboardType}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.btns}>
            <Pressable style={[styles.btn, styles.cancel]} onPress={close}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.go]} onPress={() => onSubmit(value)}>
              <Text style={styles.goText}>{submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
  },
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.default,
    padding: space.lg,
    gap: space.sm,
  },
  title: { fontFamily: fonts.title, fontSize: 20, color: colors.text },
  message: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  input: {
    // borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    marginTop: space.xs,
    height: null,
  },
  inputError: { borderColor: colors.danger, height: null },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger },
  btns: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
  btn: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md },
  cancel: { backgroundColor: colors.bg },
  cancelText: { fontFamily: fonts.semibold, color: colors.muted },
  go: { backgroundColor: colors.accent },
  goText: { fontFamily: fonts.semibold, color: '#fff' },
});
