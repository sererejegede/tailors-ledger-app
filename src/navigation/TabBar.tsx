import { useEffect, useRef, type ComponentType } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { SvgProps } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import UsersIcon from '@/assets/icons/users-01.svg';
import CompassIcon from '@/assets/icons/compass.svg';
import SettingsIcon from '@/assets/icons/settings-01.svg';

/**
 * Custom bottom tab bar (design mockup): each tab is an icon (in a maroon pill when
 * active) over its label. On becoming active the pill grows + fades in (ripple-ish) and
 * the icon pops with a quick spring; tapping also fires the native Android ripple.
 */
const ICONS: Record<string, ComponentType<SvgProps>> = {
  Clients: UsersIcon,
  Templates: CompassIcon,
  Settings: SettingsIcon,
};

type TabItemProps = {
  name: string;
  focused: boolean;
  Icon?: ComponentType<SvgProps>;
  onPress: () => void;
};

function TabItem({ name, focused, Icon, onPress }: TabItemProps) {
  const prog = useSharedValue(focused ? 1 : 0); // 0 inactive → 1 active (pill + label color)
  const pop = useSharedValue(1); // quick icon zoom on activation
  const mounted = useRef(false);

  useEffect(() => {
    prog.value = withTiming(focused ? 1 : 0, { duration: 120, easing: Easing.out(Easing.quad) });
    // Pop the icon only on an actual activation (not on first mount): a clean zoom
    // up then back down, no spring bounce.
    if (focused && mounted.current) {
      pop.value = withSequence(
        withTiming(1.18, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 120, easing: Easing.inOut(Easing.quad) }),
      );
    }
    mounted.current = true;
  }, [focused, prog, pop]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: prog.value,
    transform: [{ scale: 0.55 + prog.value * 0.45 }], // grow in from 55% → 100%
  }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(prog.value, [0, 1], [colors.muted, colors.accent]),
  }));
  // The white (active) icon cross-fades in with the pill, driven by the same `prog`.
  const whiteIconStyle = useAnimatedStyle(() => ({ opacity: prog.value }));

  return (
    <Pressable
      onPress={onPress}
      style={styles.item}
      android_ripple={{ color: colors.accentTint, borderless: true, radius: 40 }}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={name}
    >
      <View style={styles.iconWrap}>
        <Animated.View pointerEvents="none" style={[styles.pill, pillStyle]} />
        <Animated.View style={iconStyle}>
          {/* Muted base icon; the white one fades in over it as the tab activates. Driving
              the active colour off `prog` (like the label) fixes the plain SVG `color` prop
              not repainting on focus change — first-paint-not-white and not-reverting-on-blur. */}
          {Icon ? <Icon width={22} height={22} color={colors.muted} /> : null}
          {Icon ? (
            <Animated.View style={[styles.iconOverlay, whiteIconStyle]} pointerEvents="none">
              <Icon width={22} height={22} color="#fff" />
            </Animated.View>
          ) : null}
        </Animated.View>
      </View>
      <Animated.Text style={[styles.label, labelStyle]} numberOfLines={1}>
        {name}
      </Animated.Text>
    </Pressable>
  );
}

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + space.sm }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <TabItem
            key={route.key}
            name={route.name}
            focused={focused}
            Icon={ICONS[route.name]}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.accentTint,
    paddingTop: space.sm,
    paddingHorizontal: space.sm,
  },
  item: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.default,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xs,
    paddingHorizontal: space.lg,
  },
  iconOverlay: { position: 'absolute', top: 0, left: 0 },
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.default,
    backgroundColor: colors.accent,
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
