import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

/**
 * App-wide text size (Settings: normal/large). Our styles use literal fontSizes, so to
 * scale everything without touching every StyleSheet we patch the host Text/TextInput
 * render once to multiply an explicit numeric fontSize by the current scale. Text with an
 * animated or inherited size is left alone (we can't safely multiply a non-number).
 */
export const LARGE_SCALE = 1.15;

let currentScale = 1;
export function setGlobalTextScale(scale: number): void {
  currentScale = scale;
}

let patched = false;
function applyTextScalePatch(): void {
  if (patched) return;
  patched = true;
  for (const Comp of [Text, TextInput] as unknown as { render?: Function }[]) {
    const orig = Comp.render;
    if (typeof orig !== 'function') continue;
    Comp.render = function scaledRender(this: unknown, props: { style?: unknown }, ref: unknown) {
      const el = orig.call(this, props, ref) as React.ReactElement;
      if (currentScale === 1) return el;
      const flat = StyleSheet.flatten(props?.style) as { fontSize?: number; lineHeight?: number } | undefined;
      if (!flat || typeof flat.fontSize !== 'number') return el; // inherited/animated → leave it
      const extra: { fontSize: number; lineHeight?: number } = { fontSize: flat.fontSize * currentScale };
      if (typeof flat.lineHeight === 'number') extra.lineHeight = flat.lineHeight * currentScale;
      return React.cloneElement(el, { style: [props.style, extra] } as Partial<typeof el.props>);
    };
  }
}
applyTextScalePatch();

type FontScaleApi = { scale: number; setLarge: (large: boolean) => void };
const FontScaleContext = createContext<FontScaleApi>({ scale: 1, setLarge: () => {} });
export const useFontScale = (): FontScaleApi => useContext(FontScaleContext);

export function FontScaleProvider({
  initialLarge = false,
  children,
}: {
  initialLarge?: boolean;
  children: ReactNode;
}) {
  const [scale, setScale] = useState(initialLarge ? LARGE_SCALE : 1);
  // Keep the module scale in sync before children paint, and remount the subtree on change
  // so every patched Text re-renders at the new scale.
  setGlobalTextScale(scale);
  useEffect(() => {
    setGlobalTextScale(scale);
  }, [scale]);

  const setLarge = useCallback((large: boolean) => setScale(large ? LARGE_SCALE : 1), []);
  const value = useMemo(() => ({ scale, setLarge }), [scale, setLarge]);

  return (
    <FontScaleContext.Provider value={value}>
      <View style={styles.root} key={scale}>
        {children}
      </View>
    </FontScaleContext.Provider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
