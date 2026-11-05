import type { ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import PlusIcon from '@/assets/icons/plus.svg';
import ChevronIcon from '@/assets/icons/chevron-right.svg';

/**
 * The row under the measuring header (S5): who the set is for, its template and its
 * label. A measure-first draft gets a dashed "Add client"; a new set can swap its
 * template; any set can take a label. What can't be changed here is shown as plain text,
 * so nothing looks tappable that isn't.
 */
type Props = {
  isDraft: boolean;
  clientName: string;
  /** New sets can swap their template; a re-measure keeps the one it was made from. */
  canSwapTemplate: boolean;
  templateName?: string;
  label?: string;
  onAddClient: () => void;
  onSwapTemplate: () => void;
  onLabel: () => void;
};

export function EntryContext({
  isDraft,
  clientName,
  canSwapTemplate,
  templateName,
  label,
  onAddClient,
  onSwapTemplate,
  onLabel,
}: Props) {
  return (
    <View style={styles.wrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        keyboardShouldPersistTaps="handled"
      >
        {isDraft ? (
          <Pill label="Add client" Icon={PlusIcon} dashed onPress={onAddClient} />
        ) : (
          <Text style={styles.fixed} numberOfLines={1}>
            {clientName}
          </Text>
        )}
        {templateName ? (
          canSwapTemplate ? (
            <Pill label={templateName} onPress={onSwapTemplate} caret accessibilityLabel={`Template: ${templateName}`} />
          ) : (
            <Text style={styles.fixedMuted} numberOfLines={1}>
              {templateName}
            </Text>
          )
        ) : null}
        <Pill
          label={label ?? 'Add label'}
          onPress={onLabel}
          accessibilityLabel={label ? `Label: ${label}. Change label` : 'Add label'}
        />
      </ScrollView>
    </View>
  );
}

function Pill({
  label,
  onPress,
  Icon,
  dashed,
  caret,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  Icon?: ComponentType<SvgProps>;
  dashed?: boolean;
  caret?: boolean;
  accessibilityLabel?: string;
}) {
  const tint = dashed ? colors.accent : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [styles.pill, dashed && styles.dashed, pressed && styles.pressed]}
    >
      {Icon ? <Icon width={16} height={16} color={tint} /> : null}
      <Text style={[styles.pillText, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
      {caret ? <ChevronIcon width={16} height={16} color={tint} style={styles.down} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1, borderBottomColor: colors.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: 10 },
  pill: {
    height: 40,
    maxWidth: 220,
    paddingHorizontal: 14,
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dashed: { borderStyle: 'dashed', borderColor: colors.accent },
  pressed: { opacity: 0.85 },
  pillText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, flexShrink: 1 },
  down: { transform: [{ rotate: '90deg' }] },
  fixed: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text, maxWidth: 200, paddingRight: space.xs },
  fixedMuted: { fontFamily: fonts.medium, fontSize: fontSizes.sm, color: colors.muted, maxWidth: 160, paddingRight: space.xs },
});
