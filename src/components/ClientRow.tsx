import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import type Client from '@/db/models/Client';
import { initials } from '@/lib/jobBoard';
import { getRelativeTime } from '@/lib/time';

/**
 * A row on the Clients home (S1): initials, the name, the phone and when the client was
 * last updated, and what they still owe when it's above 0. `owed` comes already formatted.
 */
type Props = {
  client: Client;
  owed?: string;
  last?: boolean;
  onPress: () => void;
};

function ClientRowBase({ client, owed, last, onPress }: Props) {
  const name = client.name || 'Unnamed';
  const meta = `${client.phone?.trim() || 'No phone'} · ${getRelativeTime(client.updatedAt)}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, last && styles.last, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={owed ? `${name}, ${owed} owed` : name}
    >
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initials(name)}</Text>
      </View>
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {owed ? (
        <View style={styles.owe}>
          <Text style={styles.oweAmount}>{owed}</Text>
          <Text style={styles.oweLabel}>owed</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 64,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  pressed: { opacity: 0.6 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.round,
    backgroundColor: '#EFEBE3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontFamily: fonts.bold, fontSize: fontSizes.sm, color: colors.text },
  main: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, marginTop: 2 },
  owe: { alignItems: 'flex-end' },
  oweAmount: { ...valueText, fontSize: fontSizes.sm, fontWeight: '600', color: colors.text },
  oweLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.muted },
});

export const ClientRow = memo(ClientRowBase);
