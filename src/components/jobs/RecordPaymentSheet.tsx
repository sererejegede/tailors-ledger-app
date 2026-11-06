import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addThousands,
  bufferToMinor,
  deleteDigit,
  halfOf,
  minorToBuffer,
  pressDigit,
} from '@/lib/amountEntry';
import { formatMoney } from '@/lib/money';
import { confirmPayment } from '@/lib/overpayment';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import XCloseIcon from '@/assets/icons/x-close.svg';
import { Cursor } from '@/components/ui/Cursor';
import { TextAction } from '@/components/ui/TextAction';
import { AmountDock } from './AmountDock';
import { BottomSheet } from './BottomSheet';

/**
 * S9b. The next payment on a job, from Job detail: what's left, the amount being paid, then
 * `,000` / Half / All and the pad with Save in the corner. Save opens the receipt. Paying
 * more than what's left asks first; it's never blocked (spec §9a). With no shop name set, a
 * note says the receipt will go out without it, with a link to the shop profile; it never
 * stops the payment. Mount it to open it.
 */
type Props = {
  jobLabel: string;
  balanceMinor: number;
  currency: string;
  onSave: (amountMinor: number) => void;
  /** Given only while the shop has no name: opens the shop profile. */
  onSetUpShop?: () => void;
  onClose: () => void;
};

export function RecordPaymentSheet({ jobLabel, balanceMinor, currency, onSave, onSetUpShop, onClose }: Props) {
  const [paying, setPaying] = useState('');
  const [error, setError] = useState<string>();
  const amountMinor = bufferToMinor(paying);

  const change = (next: string) => {
    setPaying(next);
    setError(undefined);
  };

  const save = () => {
    if (!amountMinor) {
      setError('Enter what was paid.');
      return;
    }
    // "Change amount" leaves the sheet open with the amount still in it.
    confirmPayment(balanceMinor, amountMinor, currency, () => onSave(amountMinor));
  };

  return (
    <BottomSheet onClose={onClose}>
      <View>
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            Record payment
          </Text>
          <Pressable onPress={onClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Close">
            <XCloseIcon width={22} height={22} color={colors.text} />
          </Pressable>
        </View>
        <Text style={[styles.sub, error ? styles.error : null]} numberOfLines={1}>
          {error ?? (
            <>
              {jobLabel} · <Text style={styles.left}>{formatMoney(balanceMinor, currency)}</Text> left
            </>
          )}
        </Text>
      </View>

      {onSetUpShop ? (
        <View style={styles.shop}>
          <View style={styles.dot} />
          <Text style={styles.shopText}>No shop name yet, so this receipt won’t show it.</Text>
          <TextAction label="Set up shop" onPress={onSetUpShop} />
        </View>
      ) : null}

      <View style={styles.paying}>
        <Text style={styles.payingLabel}>Paying now</Text>
        <View style={styles.payingRow}>
          <Text style={styles.payingValue} numberOfLines={1}>
            {formatMoney(amountMinor, currency)}
          </Text>
          <Cursor height={28} />
        </View>
      </View>

      <AmountDock
        onDigit={(d) => change(pressDigit(paying, d))}
        onDelete={() => change(deleteDigit(paying))}
        onThousands={() => change(addThousands(paying))}
        onHalf={() => change(halfOf(balanceMinor))}
        onAll={() => change(minorToBuffer(balanceMinor))}
        allLabel="All"
        halfActive={balanceMinor > 0 && amountMinor === bufferToMinor(halfOf(balanceMinor))}
        allActive={balanceMinor > 0 && amountMinor === balanceMinor}
        onSave={save}
      />
      <Text style={styles.note}>Save opens the receipt, ready to share. More than what's left asks first.</Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -space.sm },
  title: { fontFamily: fonts.titleSemi, fontSize: 22, color: colors.text },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  sub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted, marginTop: -space.xs },
  left: { ...valueText, color: colors.text },
  error: { color: colors.danger },
  paying: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    backgroundColor: colors.accentTint,
    borderRadius: radius.card,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  payingLabel: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.accentInk },
  payingRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  payingValue: { ...valueText, flexShrink: 1, fontSize: 32, color: colors.accentInk },
  shop: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: -space.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.warn },
  shopText: { flex: 1, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.text },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center' },
});
