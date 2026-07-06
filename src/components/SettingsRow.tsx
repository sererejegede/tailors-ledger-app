import { colors, space, fontSizes } from "@/theme/tokens";
import { fonts } from "@/theme/typography";
import { memo } from "react";
import { Text, StyleSheet, Pressable, Switch } from "react-native";

type Props = {
  title: string;
  value: string | boolean;
  disabled?: boolean;
  onPress: () => void;
};

// `activeThumbColor` is a react-native-web-only Switch prop (absent from RN's native
// SwitchProps). Without it the "on" thumb falls back to RN-web's teal default (#009688);
// setting it keeps the thumb white in both states. Ignored on native, where `thumbColor`
// already covers both states.
const webSwitchProps = { activeThumbColor: '#fff' } as { activeThumbColor?: string };

const SettingsRowBase = ({ title, value, disabled, onPress }: Props) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      disabled={disabled}
    >
      <Text style={[styles.title, disabled && { color: colors.faint }]}>{title}</Text>
      {typeof value === 'boolean' 
        ? <Switch
            value={value}
            onValueChange={onPress}
            trackColor={{ true: colors.accent, false: colors.line2 }}
            thumbColor="#fff"
            {...webSwitchProps}
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
    paddingBlock: space.lg,
    paddingInline: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  pressed: {
    backgroundColor: colors.accentTint,
  },
  title: {
    fontFamily: fonts.semibold,
    fontSize: fontSizes.base,
    color: colors.text,
  },
  value: {
    fontFamily: fonts.body,
    fontSize: fontSizes.sm,
    color: colors.muted,
  },
});