import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import type Payment from '@/db/models/Payment';
import { Alert } from '@/lib/alert';
import { receiptView } from '@/lib/receipt';
import { shareReceipt } from '@/lib/sharePdf';
import { getPayment, voidPayment } from '@/repositories/jobs';
import { getSettings } from '@/repositories/settings';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { ReceiptCard } from '@/components/jobs';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Receipt'>;

const PAPER_BORDER = 1;

/** Opens straight after Save. All of it works offline. */
export default function ReceiptScreen({ route, navigation }: Props) {
  const { paymentId } = route.params;
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [voidedAt, setVoidedAt] = useState<number | null>(null);
  const [logoUri, setLogoUri] = useState<string>();
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    (async () => {
      const [found, settings] = await Promise.all([getPayment(database, paymentId), getSettings(database)]);
      setPayment(found);
      setVoidedAt(found.voidedAt ?? null);
      setLogoUri(settings?.logoUri || undefined);
    })();
  }, [paymentId]);

  const view = useMemo(
    () =>
      payment &&
      receiptView({
        receiptNumber: payment.receiptNumber,
        amountMinor: payment.amountMinor,
        paidAt: payment.paidAt,
        voidedAt,
        receipt: payment.receipt,
      }),
    [payment, voidedAt],
  );

  useEffect(() => {
    if (view) navigation.setOptions({ title: `Receipt ${view.number}` });
  }, [navigation, view]);

  const share = useCallback(async () => {
    if (!view || sharing) return;
    setSharing(true);
    try {
      await shareReceipt(view, logoUri);
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  }, [view, logoUri, sharing]);

  const confirmVoid = useCallback(() => {
    if (!view) return;
    Alert.alert(
      `Void receipt ${view.number}?`,
      'It stops counting towards the balance. The number stays used.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Void',
          style: 'destructive',
          onPress: async () => {
            const voided = await voidPayment(database, paymentId);
            setVoidedAt(voided.voidedAt ?? null);
          },
        },
      ],
    );
  }, [view, paymentId]);

  if (!view) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.preview}>
        {/* Measured, not the window: on web the app sits in a narrower column. */}
        <View style={styles.paper} onLayout={(e) => setWidth(e.nativeEvent.layout.width - PAPER_BORDER * 2)}>
          {width > 0 ? <ReceiptCard view={view} logoUri={logoUri} width={width} /> : null}
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable
          style={[styles.share, sharing && styles.shareBusy]}
          onPress={share}
          disabled={sharing}
          accessibilityRole="button"
        >
          <Text style={styles.shareText}>Share</Text>
        </Pressable>
        {view.voided ? null : (
          <Pressable style={styles.void} onPress={confirmVoid} accessibilityRole="button">
            <Text style={styles.voidText}>Void receipt</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  preview: { paddingHorizontal: space.lg, paddingBottom: space.md },
  paper: { borderWidth: PAPER_BORDER, borderColor: colors.line },
  actions: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  share: {
    height: 56,
    borderRadius: radius.default,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBusy: { opacity: 0.6 },
  shareText: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: '#fff' },
  void: { height: 44, alignItems: 'center', justifyContent: 'center' },
  voidText: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.danger },
});
