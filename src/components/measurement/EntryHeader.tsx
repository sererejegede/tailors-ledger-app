import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';

/**
 * The who + progress strip under the top bar. For an unnamed measure-first draft the name
 * area is a button that creates/attaches the client up front (before saving measurements).
 */
type Props = {
  isDraft: boolean;
  clientName: string;
  label?: string;
  filled: number;
  total: number;
  onAddClient: () => void;
};

export function EntryHeader({ isDraft, clientName, label, filled, total, onAddClient }: Props) {
  return (
    <View style={styles.entryHd}>
      {isDraft ? (
        <Pressable onPress={onAddClient}>
          <Text style={styles.unnamed}>Unnamed draft</Text>
          <Text style={styles.sub}>tap to add the client</Text>
        </Pressable>
      ) : (
        <View>
          <Text style={styles.who}>{clientName}</Text>
          {label ? <Text style={styles.sub}>{label}</Text> : null}
        </View>
      )}
      <Text style={styles.progress}>
        <Text style={styles.progressNum}>{filled}</Text>/{total} filled
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  entryHd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  who: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  unnamed: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.accent },
  sub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.muted },
  progress: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  progressNum: { fontFamily: fonts.bold, color: colors.text },
});
