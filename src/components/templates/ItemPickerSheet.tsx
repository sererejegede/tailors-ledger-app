import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { Portal } from '@/components/OverlayHost';

type Option = {
  id: string;
  name: string;
};

type Props = {
  visible: boolean;
  options: Option[];
  currentId?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  bottomInset: number;
};

export function ItemPickerSheet({ visible, options, currentId, onSelect, onClose, bottomInset }: Props) {
  if (!visible) return null;
  return (
    <Portal>
      <View style={styles.pickerOverlay}>
        <Pressable style={styles.pickerScrim} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: bottomInset + space.lg }]}>
          <Text style={styles.sheetTitle}>Choose</Text>
          {options.map((o) => {
            const current = o.id === currentId;
            return (
              <Pressable key={o.id} style={styles.option} onPress={() => onSelect(o.id)}>
                <Text style={[styles.optionText, current && styles.optionCurrent]}>{o.name}</Text>
                {current ? <Text style={styles.optionCheck}>✓</Text> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  pickerOverlay: { flex: 1, justifyContent: 'flex-end' },
  pickerScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(27,26,23,0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: space.xs,
  },
  sheetTitle: {
    fontFamily: fonts.titleSemi,
    fontSize: 16,
    color: colors.text,
    marginBottom: space.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  optionText: { fontFamily: fonts.medium, fontSize: 16, color: colors.text },
  optionCurrent: { color: colors.accent, fontFamily: fonts.semibold },
  optionCheck: { fontFamily: fonts.bold, fontSize: 16, color: colors.accent },
});
