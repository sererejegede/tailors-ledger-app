import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { colors, space, fontSizes } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { AmountDock } from './AmountDock';
import { BottomSheet } from './BottomSheet';

/** The next payment on a job: one tap on Balance, then Save. */
type Props = {
  balanceMinor: number;
  currency: string;
  onSave: (amountMinor: number) => void;
  onClose: () => void;
};

export function RecordPaymentSheet({ balanceMinor, currency, onSave, onClose }: Props) {
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
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Paying now</Text>
          <Text style={[styles.sub, error ? styles.error : null]}>
            {error ?? `Balance ${formatMoney(balanceMinor, currency)}`}
          </Text>
        </View>
        <Text style={styles.amount}>{formatMoney(amountMinor, currency)}</Text>
      </View>
      <AmountDock
        onDigit={(d) => change(pressDigit(paying, d))}
        onDelete={() => change(deleteDigit(paying))}
        onThousands={() => change(addThousands(paying))}
        onHalf={() => change(halfOf(balanceMinor))}
        onAll={() => change(minorToBuffer(balanceMinor))}
        allLabel="Balance"
        halfActive={balanceMinor > 0 && amountMinor === bufferToMinor(halfOf(balanceMinor))}
        allActive={balanceMinor > 0 && amountMinor === balanceMinor}
        onSave={save}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  title: { fontFamily: fonts.semibold, fontSize: fontSizes.lg, color: colors.text },
  sub: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  error: { color: colors.danger },
  amount: { ...valueText, flexShrink: 1, fontSize: fontSizes['3xl'], fontWeight: '700', color: colors.accent },
});
