import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { Portal } from '@/components/OverlayHost';
import { hasSeenTip, markTipSeen } from '@/lib/seenTips';

/**
 * A one-time contextual coach-mark: a dimmed scrim + a small hint card, shown the first
 * time the user reaches a screen with a non-obvious gesture (swipe-to-delete, tap-to-jump,
 * quick-edit…). It never blocks the flow — tapping the scrim or "Got it" dismisses it and
 * marks the tip seen. Placement is coarse (top/bottom/center) rather than pinned to a
 * measured target: the copy + any paired nudge convey the gesture, and this stays robust
 * across layouts. Replayable via Settings → "How to use" (resetTips).
 */

type Placement = 'top' | 'bottom' | 'center';

type Props = {
  visible: boolean;
  title: string;
  lines: string[];
  placement?: Placement;
  onDismiss: () => void;
};

export function CoachMark({ visible, title, lines, placement = 'center', onDismiss }: Props) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const justify =
    placement === 'top' ? 'flex-start' : placement === 'bottom' ? 'flex-end' : 'center';

  return (
    <Portal>
      <View style={styles.overlay} pointerEvents="box-none">
        {/* Scrim blocks touches to the UI behind but does NOT dismiss — only the explicit
            "Got it" button closes the coach-mark, to avoid accidental taps skipping it. */}
        <View style={styles.scrim} />
        <View
          pointerEvents="box-none"
          style={[
            styles.container,
            {
              justifyContent: justify,
              paddingTop: insets.top + space.xl,
              paddingBottom: insets.bottom + space.xxl,
            },
          ]}
        >
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            {lines.map((line) => (
              <Text key={line} style={styles.line}>
                {line}
              </Text>
            ))}
            <Pressable style={styles.button} onPress={onDismiss}>
              <Text style={styles.buttonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Portal>
  );
}

/**
 * Drives a coach-mark's visibility from the persisted seen-state. Shows only when
 * `enabled` (e.g. the screen has settled and has content) and the tip hasn't been seen.
 * `dismiss` hides it and records it as seen.
 */
export function useCoachMark(id: string, enabled: boolean): { visible: boolean; dismiss: () => void } {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    hasSeenTip(id).then((seen) => {
      if (!cancelled && !seen) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, enabled]);

  const dismiss = useCallback(() => {
    setVisible(false);
    void markTipSeen(id);
  }, [id]);

  return { visible, dismiss };
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, elevation: 1000 },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(27,26,23,0.45)' },
  container: { flex: 1, paddingHorizontal: space.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.default,
    padding: space.lg,
    gap: space.xs,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  title: { fontFamily: fonts.title, fontSize: 19, color: colors.text, marginBottom: space.xs },
  line: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, lineHeight: 22 },
  button: {
    alignSelf: 'flex-end',
    marginTop: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  buttonText: { fontFamily: fonts.bold, fontSize: 15, color: '#fff' },
});
