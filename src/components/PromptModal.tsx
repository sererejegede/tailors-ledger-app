import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/**
 * Minimal single-field prompt (Android has no Alert.prompt). Used to name an unnamed
 * draft and to add an ad-hoc item. Shows an optional inline error (e.g. duplicate name).
 */
type Props = {
  visible: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  submitLabel?: string;
  error?: string;
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
  onCancel,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<TextInput>(null);
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
      // Focus AFTER the modal is on screen so the keyboard opens reliably and the card
      // is laid out above it (autoFocus inside a Modal can fire too early on Android).
      onShow={() => setTimeout(() => inputRef.current?.focus(), 60)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropFill} onPress={onCancel} />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <TextInput
            ref={inputRef}
            style={[styles.input, error ? styles.inputError : null]}
            placeholder={placeholder}
            placeholderTextColor={colors.faint}
            value={value}
            onChangeText={setValue}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => onSubmit(value)}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.btns}>
            <Pressable style={[styles.btn, styles.cancel]} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.go]} onPress={() => onSubmit(value)}>
              <Text style={styles.goText}>{submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: space.xl },
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
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  title: { fontFamily: fonts.title, fontSize: 20, color: colors.text },
  message: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  input: {
    borderWidth: 1,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
    color: colors.text,
    marginTop: space.xs,
  },
  inputError: { borderColor: colors.danger },
  error: { fontFamily: fonts.medium, fontSize: 13, color: colors.danger },
  btns: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm, marginTop: space.sm },
  btn: { paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.md },
  cancel: { backgroundColor: colors.bg },
  cancelText: { fontFamily: fonts.semibold, color: colors.muted },
  go: { backgroundColor: colors.accent },
  goText: { fontFamily: fonts.semibold, color: '#fff' },
});
