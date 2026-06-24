import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * A dependency-free portal. Content rendered through <Portal> is hoisted to a single
 * outlet mounted at the app root, ABOVE the navigator. Two reasons we need this for the
 * prompt overlay:
 *   1. Touch — a prompt rendered inside a screen sits inside that screen's ScrollView,
 *      whose default keyboardShouldPersistTaps="never" eats the first tap (to dismiss the
 *      keyboard) before it reaches the overlay. At the root there is no such ancestor.
 *   2. Visuals — the navigator's native header/tab bar render above a screen, so an
 *      in-screen scrim can't dim them. The root outlet covers everything.
 */
type HostApi = {
  mount: (id: string, node: ReactNode) => void;
  unmount: (id: string) => void;
};

const OverlayHostContext = createContext<HostApi | null>(null);

export function OverlayHostProvider({ children }: { children: ReactNode }) {
  const [nodes, setNodes] = useState<Record<string, ReactNode>>({});

  const mount = useCallback((id: string, node: ReactNode) => {
    setNodes((prev) => ({ ...prev, [id]: node }));
  }, []);
  const unmount = useCallback((id: string) => {
    setNodes((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const api = useMemo(() => ({ mount, unmount }), [mount, unmount]);
  const ids = Object.keys(nodes);

  return (
    <OverlayHostContext.Provider value={api}>
      {/* `children` keeps a stable element identity, so host state changes here re-render
          only the outlet, not the whole navigation tree. */}
      <View style={styles.root}>
        {children}
        {ids.length > 0 ? (
          <View style={styles.outlet} pointerEvents="box-none">
            {ids.map((id) => (
              <View key={id} style={StyleSheet.absoluteFill} pointerEvents="box-none">
                {nodes[id]}
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </OverlayHostContext.Provider>
  );
}

export function Portal({ children }: { children: ReactNode }) {
  const host = useContext(OverlayHostContext);
  const id = useId();

  // Push the latest children on every render so controlled inputs stay in sync.
  useEffect(() => {
    host?.mount(id, children);
  });
  // Remove only on real unmount.
  useEffect(() => () => host?.unmount(id), [host, id]);

  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  outlet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
  },
});
