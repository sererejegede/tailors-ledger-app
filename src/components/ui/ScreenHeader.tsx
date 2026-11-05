import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import BackIcon from '@/assets/icons/arrow-narrow-left.svg';

type Props = {
  title: string;
  /** Defaults to going back one screen. */
  onBack?: () => void;
};

/**
 * The header for every screen that isn't a tab: Back and the title, nothing else. The
 * screen's actions live in its `BottomBar`. Draws under the status bar, so the route
 * hides the navigator's own header.
 */
export function ScreenHeader({ title, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.sm }]}>
      <Pressable
        onPress={onBack ?? (() => navigation.goBack())}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <BackIcon width={24} height={24} color={colors.accent} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

/** A tab screen's big title (Clients, Jobs, Settings). */
export function TabTitle({ title }: { title: string }) {
  const insets = useSafeAreaInsets();
  return (
    <Text style={[styles.big, { paddingTop: insets.top + space.xl }]} accessibilityRole="header">
      {title}
    </Text>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingLeft: space.xs,
    paddingRight: space.sm,
    paddingBottom: space.xs,
    backgroundColor: colors.bg,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: fonts.titleSemi, fontSize: 22, color: colors.text },
  big: {
    fontFamily: fonts.title,
    fontSize: 32,
    color: colors.text,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    backgroundColor: colors.bg,
  },
});
