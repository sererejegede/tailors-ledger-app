import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { Portal } from '@/components/OverlayHost';

/**
 * A transient bottom snackbar with an optional action — used for undo-on-delete (the swipe
 * that the template coach-mark teaches) and any brief "done, but reversible" feedback. It
 * auto-dismisses; tapping the action runs it and dismisses immediately. Provider + Portal
 * mirror OverlayHost so a single bar renders above the navigator. Must be mounted inside
 * OverlayHostProvider (it uses Portal).
 */
type SnackOptions = {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Auto-dismiss delay in ms (default 4000). */
  duration?: number;
};

type SnackApi = { showSnackbar: (opts: SnackOptions) => void };

const SnackbarContext = createContext<SnackApi>({ showSnackbar: () => {} });

export const useSnackbar = (): SnackApi => useContext(SnackbarContext);

type Current = SnackOptions & { key: number };

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<Current | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const clearTimer = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const dismiss = useCallback(() => {
    clearTimer();
    setCurrent(null);
  }, [clearTimer]);

  const showSnackbar = useCallback(
    (opts: SnackOptions) => {
      clearTimer();
      const key = ++seq.current;
      setCurrent({ ...opts, key });
      timer.current = setTimeout(() => {
        // Only clear if this is still the same snack (a newer one may have replaced it).
        setCurrent((c) => (c?.key === key ? null : c));
      }, opts.duration ?? 4000);
    },
    [clearTimer],
  );

  useEffect(() => clearTimer, [clearTimer]);

  const api = useMemo(() => ({ showSnackbar }), [showSnackbar]);

  return (
    <SnackbarContext.Provider value={api}>
      {children}
      {current ? (
        <Portal>
          <View
            style={[styles.wrap, { paddingBottom: insets.bottom + space.md }]}
            pointerEvents="box-none"
          >
            <View style={styles.bar}>
              <Text style={styles.message} numberOfLines={2}>
                {current.message}
              </Text>
              {current.actionLabel ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    current.onAction?.();
                    dismiss();
                  }}
                >
                  <Text style={styles.action}>{current.actionLabel}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </Portal>
      ) : null}
    </SnackbarContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    alignSelf: 'stretch',
    backgroundColor: colors.text,
    borderRadius: radius.md,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  message: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.bg },
  action: { fontFamily: fonts.bold, fontSize: 14, color: colors.accentTint },
});
