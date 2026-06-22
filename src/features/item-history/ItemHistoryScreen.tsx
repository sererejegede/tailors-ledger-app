import { useCallback, useLayoutEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import type MeasurementValue from '@/db/models/MeasurementValue';
import { getItemHistory } from '@/repositories/items';
import { formatInches } from '@/lib/units';
import { getRelativeTime } from '@/lib/time';
import { colors, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ItemHistory'>;

/** Timeline of an item's values, newest first (the newest is the current value). */
export default function ItemHistoryScreen({ route, navigation }: Props) {
  const { itemId, itemKey } = route.params;
  const [history, setHistory] = useState<MeasurementValue[]>([]);

  const load = useCallback(async () => {
    setHistory(await getItemHistory(database, itemId));
  }, [itemId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: itemKey });
  }, [navigation, itemKey]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {history.length === 0 ? (
        <Text style={styles.empty}>No history yet — this item hasn’t been measured.</Text>
      ) : (
        history.map((entry, i) => (
          <View key={entry.id} style={styles.row}>
            <View style={styles.timeline}>
              <View style={[styles.dot, i === 0 && styles.dotCurrent]} />
              {i < history.length - 1 ? <View style={styles.line} /> : null}
            </View>
            <View style={styles.entry}>
              <Text style={[styles.value, i === 0 && styles.valueCurrent]}>
                {formatInches(entry.value)}
              </Text>
              <Text style={styles.when}>
                {i === 0 ? 'now · ' : ''}
                {getRelativeTime(entry.recordedAt)}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg },
  empty: { fontFamily: fonts.body, fontSize: 15, color: colors.muted, paddingTop: space.md },
  row: { flexDirection: 'row', gap: space.md },
  timeline: { alignItems: 'center', width: 16 },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.line2,
    marginTop: 4,
  },
  dotCurrent: { backgroundColor: colors.accent },
  line: { flex: 1, width: 2, backgroundColor: colors.line, marginVertical: 2 },
  entry: { flex: 1, paddingBottom: space.lg },
  value: { ...valueText, fontSize: 22, color: colors.text },
  valueCurrent: { color: colors.accentInk },
  when: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
});
