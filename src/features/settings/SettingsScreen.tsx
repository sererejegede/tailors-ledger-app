import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/** Placeholder — units, fraction steps, default template, app lock, etc. land in 3b. */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.md }]}>
      <Text style={styles.h1}>Settings</Text>
      <Text style={styles.note}>Settings arrive in the next step (3b).</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: space.lg },
  h1: { fontFamily: fonts.title, fontSize: 28, color: colors.text, marginBottom: space.sm },
  note: { fontFamily: fonts.body, fontSize: 15, color: colors.muted },
});
