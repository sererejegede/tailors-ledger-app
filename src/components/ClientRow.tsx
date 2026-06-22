import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import ClockIcon from '@/assets/icons/clock-rewind.svg';
import ChevronIcon from '@/assets/icons/chevron-right.svg';
import type Client from '@/db/models/Client';
import { getRelativeTime } from '@/lib/time';

/**
 * A client list row (Clients home / search results): the client's name, a clock-rewind
 * icon + a "last updated" line beneath it, and a chevron affordance. Presentational —
 * the caller passes the already-formatted `subtitle` (e.g. "Updated 2h ago").
 */
type Props = {
  client: Client;
  onPress: () => void;
};

function ClientRowBase({ client, onPress }: Props) {
  const relativeTime = getRelativeTime(client.updatedAt);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={client.name}
    >
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {client.name || 'Unnamed'}
        </Text>
        {relativeTime ? (
          <View style={styles.meta}>
            <ClockIcon width={14} height={14} color={colors.muted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {relativeTime}
            </Text>
          </View>
        ) : null}
      </View>
      <ChevronIcon width={20} height={20} color={colors.faint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.bg,
  },
  pressed: { backgroundColor: colors.accentTint },
  main: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.semibold, fontSize: 18, color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
});

export const ClientRow = memo(ClientRowBase);
