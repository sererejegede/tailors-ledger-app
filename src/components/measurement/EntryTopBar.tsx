import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import BackIcon from '@/assets/icons/arrow-narrow-left.svg';
import ChevronIcon from '@/assets/icons/chevron-right.svg';

/**
 * The hero's custom top bar (this route hides the native header). Back · title · Save.
 * For a NEW set the title is the swappable template name (tap to pick another).
 */
type Props = {
  isNew: boolean;
  templateName?: string;
  onBack: () => void;
  onSave: () => void;
  onSwapTemplate: () => void;
  topInset: number;
};

export function EntryTopBar({ isNew, templateName, onBack, onSave, onSwapTemplate, topInset }: Props) {
  return (
    <View style={[styles.topbar, { paddingTop: topInset + space.sm }]}>
      <Pressable onPress={onBack} hitSlop={12} accessibilityLabel="Back">
        <BackIcon width={28} height={28} color={colors.accent} />
      </Pressable>
      {isNew ? (
        <Pressable style={styles.titleBtn} onPress={onSwapTemplate} hitSlop={8}>
          <Text style={styles.titleText} numberOfLines={1}>
            {templateName ?? 'Measure'}
          </Text>
          <ChevronIcon style={styles.caret} width={20} height={20} color={colors.faint} />
        </Pressable>
      ) : (
        <Text style={styles.title} numberOfLines={1}>
          Measure{templateName ? ` · ${templateName}` : ''}
        </Text>
      )}
      <Pressable onPress={onSave} hitSlop={12} accessibilityRole="button">
        <Text style={styles.save}>Save</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  title: { fontFamily: fonts.titleSemi, fontSize: fontSizes.lg, color: colors.text, flex: 1, textAlign: 'center' },
  titleBtn: {
    // flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleText: { fontFamily: fonts.titleSemi, fontSize: fontSizes.lg, color: colors.text, flexShrink: 1, textAlign: 'center' },
  caret: { color: colors.accent, transform: [{ rotate: '90deg' }] },
  save: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: colors.accent },
});
