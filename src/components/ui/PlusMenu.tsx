import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import PlusIcon from '@/assets/icons/plus.svg';

export type PlusMenuItem = { label: string; Icon: ComponentType<SvgProps>; onPress: () => void };

type Props = {
  items: PlusMenuItem[];
  accessibilityLabel: string;
};

const FAB = 60;
const ICON = 22;
const DURATION = 180;

/**
 * A tab screen's one + button (S1a). Tapping it turns the + into an × and lists what it
 * can do, each as a labelled pill stacked above the button. Tap ×, Back or anywhere
 * else on the screen to close (nothing is dimmed); it also closes when the screen loses
 * focus. Render it last in the screen so it sits above the list.
 */
export function PlusMenu({ items, accessibilityLabel }: Props) {
  const [open, setOpen] = useState(false);
  const prog = useSharedValue(0); // 0 closed → 1 open

  useEffect(() => {
    prog.value = withTiming(open ? 1 : 0, { duration: DURATION, easing: Easing.out(Easing.quad) });
  }, [open, prog]);

  useEffect(() => {
    if (!open) return;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => back.remove();
  }, [open]);

  // Leaving the tab (or opening a screen from the menu) closes it.
  useFocusEffect(useCallback(() => () => setOpen(false), []));

  const iconStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${prog.value * 45}deg` }] }));
  const itemsStyle = useAnimatedStyle(() => ({
    opacity: prog.value,
    transform: [{ translateY: (1 - prog.value) * 12 }],
  }));

  const choose = (item: PlusMenuItem) => {
    setOpen(false);
    item.onPress();
  };

  return (
    <>
      {open ? (
        // Invisible: a tap anywhere outside the menu only closes it.
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setOpen(false)}
          accessible={false}
          importantForAccessibility="no"
        />
      ) : null}
      <View style={styles.anchor} pointerEvents="box-none">
        <Animated.View
          style={[styles.items, itemsStyle]}
          pointerEvents={open ? 'box-none' : 'none'}
          accessibilityElementsHidden={!open}
          importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}
        >
          {items.map((item) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
              onPress={() => choose(item)}
              accessibilityRole="button"
              accessibilityLabel={item.label}
            >
              <Text style={styles.itemLabel}>{item.label}</Text>
              <item.Icon width={ICON} height={ICON} color={colors.text} />
            </Pressable>
          ))}
        </Animated.View>

        <Pressable
          style={styles.fab}
          onPress={() => setOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityLabel={open ? 'Close menu' : accessibilityLabel}
          accessibilityState={{ expanded: open }}
        >
          <Animated.View style={iconStyle}>
            <PlusIcon width={28} height={28} color="#fff" />
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

const shadow = {
  shadowColor: '#14120F',
  shadowOpacity: 0.15,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 4,
};

const styles = StyleSheet.create({
  anchor: { position: 'absolute', right: space.lg, bottom: space.lg, alignItems: 'flex-end', gap: space.md },
  items: { alignItems: 'flex-end', gap: space.md },
  // The label and its icon share one pill; the icon lines up with the centre of the button.
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    height: 48,
    paddingLeft: space.lg + space.xs,
    paddingRight: (FAB - ICON) / 2,
    borderRadius: radius.round,
    backgroundColor: colors.surface,
    ...shadow,
  },
  pressed: { opacity: 0.85 },
  itemLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  fab: {
    width: FAB,
    height: FAB,
    borderRadius: radius.round,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentInk,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
