import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { bankLines } from '@/lib/invoice';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';
import { Field, ScreenHeader, SectionLabel, useKeyboardHeight } from '@/components/ui';
import { useSettingsForm } from './useSettingsForm';

/**
 * S11b. The bank, account name and account number printed on invoices so a client can pay
 * by transfer, with the invoice's box drawn underneath as it will print. All optional;
 * saved as you type.
 */
export default function PaymentDetailsScreen() {
  const { settings, queue } = useSettingsForm();
  if (!settings) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Payment details" />
      </View>
    );
  }
  return (
    <PaymentDetailsForm
      bank={settings.bankName}
      name={settings.bankAccountName}
      number={settings.bankAccountNumber}
      queue={queue}
    />
  );
}

type FormProps = {
  bank?: string;
  name?: string;
  number?: string;
  queue: ReturnType<typeof useSettingsForm>['queue'];
};

function PaymentDetailsForm({ queue, ...initial }: FormProps) {
  const keyboard = useKeyboardHeight();
  const [bank, setBank] = useState(initial.bank ?? '');
  const [name, setName] = useState(initial.name ?? '');
  const [number, setNumber] = useState(initial.number ?? '');
  const lines = bankLines({ name: bank, accountName: name, accountNumber: number });

  return (
    <View style={[styles.screen, { paddingBottom: keyboard }]}>
      <ScreenHeader title="Payment details" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>This is printed on invoices so clients can pay by transfer.</Text>
        <Field
          label="Bank"
          value={bank}
          onChangeText={(v) => {
            setBank(v);
            queue({ bankName: v.trim() });
          }}
          placeholder="GTBank"
          autoCapitalize="words"
        />
        <Field
          label="Account name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            queue({ bankAccountName: v.trim() });
          }}
          placeholder="As the bank has it"
          autoCapitalize="words"
        />
        <Field
          label="Account number"
          mono
          value={number}
          onChangeText={(v) => {
            setNumber(v);
            // Text, so leading zeros survive (data model §3).
            queue({ bankAccountNumber: v.trim() });
          }}
          placeholder="0123456789"
          keyboardType="number-pad"
          inputMode="numeric"
        />

        <SectionLabel title="On the invoice" />
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Pay by bank transfer</Text>
          {lines.length ? (
            lines.map((line) => (
              <View key={line.label} style={styles.line}>
                <Text style={styles.lineLabel}>{line.label}</Text>
                <Text style={[styles.lineValue, line.number && styles.mono]} numberOfLines={1}>
                  {line.value}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.lineLabel}>Left off the invoice until something is filled in.</Text>
          )}
        </View>
        <Text style={styles.note}>Changes save as you go.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  intro: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.muted },
  preview: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    shadowColor: '#14120F',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  previewTitle: { fontFamily: fonts.bold, fontSize: 13, color: colors.text, marginBottom: space.xs },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.md },
  lineLabel: { fontFamily: fonts.body, fontSize: 13, lineHeight: 21, color: colors.muted },
  lineValue: { flexShrink: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 21, color: colors.text },
  mono: valueText,
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 14 },
});
