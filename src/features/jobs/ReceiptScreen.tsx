import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import type Payment from '@/db/models/Payment';
import { Alert } from '@/lib/alert';
import { receiptView } from '@/lib/receipt';
import { shareReceipt } from '@/lib/sharePdf';
import { getPayment, voidPayment } from '@/repositories/jobs';
import { getSettings } from '@/repositories/settings';
import { colors, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { ReceiptCard } from '@/components/jobs';
import { BottomBar, Button, ScreenHeader, TextAction } from '@/components/ui';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Receipt'>;

const PAPER_BORDER = 1;

/**
 * S10. The receipt as it will print, opened straight after a payment's Save. *Share receipt*
 * is the main action; *Void this receipt…* is a red link under the paper, away from it.
 * All of it works offline.
 */
export default function ReceiptScreen({ route }: Props) {
  const { paymentId } = route.params;
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
      <ScreenHeader title={`Receipt ${view.number}`} />
      <ScrollView contentContainerStyle={styles.preview}>
        {/* Measured, not the window: on web the app sits in a narrower column. */}
        <View style={styles.paper} onLayout={(e) => setWidth(e.nativeEvent.layout.width - PAPER_BORDER * 2)}>
          {width > 0 ? <ReceiptCard view={view} logoUri={logoUri} width={width} /> : null}
        </View>
        <Text style={styles.caption}>A5, as it will print</Text>
        {view.voided ? null : (
          <TextAction label="Void this receipt…" danger onPress={confirmVoid} style={styles.void} />
        )}
      </ScrollView>

      <BottomBar>
        <Button kind="primary" label={sharing ? 'Preparing…' : 'Share receipt'} onPress={share} disabled={sharing} />
      </BottomBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  preview: { paddingHorizontal: space.xl, paddingTop: space.xs, paddingBottom: space.lg },
  paper: {
    borderWidth: PAPER_BORDER,
    borderColor: colors.line,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  caption: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 14 },
  void: { alignSelf: 'center', marginTop: space.md },
});
