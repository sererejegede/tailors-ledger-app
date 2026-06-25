import { colors, space } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { memo } from "react";
import { Text, StyleSheet, Pressable, Switch } from "react-native";

type Props = {
  title: string;
  value: string | boolean;
  onPress: () => void;
};

const SettingsRowBase = ({ title, value, onPress }: Props) => {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.container, pressed && styles.pressed]}>
      <Text style={styles.title}>{title}</Text>
      {typeof value === 'boolean' 
        ? <Switch
            value={value}
            onValueChange={onPress}
            trackColor={{ true: colors.accent, false: colors.line2 }}
            thumbColor="#fff"
          /> 
        : <Text style={styles.value}>{value}</Text>
      }
    </Pressable>
  );
};

export const SettingsRow = memo(SettingsRowBase);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBlock: space.md,
    paddingInline: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: {
    backgroundColor: colors.line,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
  },
  value: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.muted,
  },
});