import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { database } from '@/db';
import { peekNextReceiptNumber } from '@/repositories/jobs';
import { Alert } from '@/lib/alert';
import { pickOneFromGallery } from '@/lib/images';
import { useImageSrc } from '@/lib/imageSrc';
import { CURRENCIES, DEFAULT_CURRENCY } from '@/lib/money';
import { parseNextReceiptNumber } from '@/lib/settingsSummary';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { ItemPickerSheet } from '@/components/templates';
import {
  Field,
  FieldButton,
  fieldBox,
  ScreenHeader,
  SectionLabel,
  TextAction,
  useKeyboardHeight,
} from '@/components/ui';
import ChevronIcon from '@/assets/icons/chevron-right.svg';
import { useSettingsForm } from './useSettingsForm';

/** It goes into every receipt and invoice, so it's kept small. */
const LOGO_MAX_BYTES = 1024 * 1024;

const currencyOptions =CURRENCIES.map((c) => ({ id: c.code as string, name: `${c.code} ${c.symbol}  ${c.name}` }));

/**
 * S11a. What every receipt and invoice prints: the logo, name, phone, address, the receipt
 * footer, the next receipt number and the currency. Saved as you type; all of it stays on
 * this phone. A receipt freezes these when it's saved, except the logo (a local file).
 */
export default function ShopProfileScreen() {
  const { settings, queue, save } = useSettingsForm();
  const keyboard = useKeyboardHeight();
  const [nextMin, setNextMin] = useState<number | null>(null);
  const [nextText, setNextText] = useState('');
  const [nextError, setNextError] = useState<string>();
  const [pickingCurrency, setPickingCurrency] = useState(false);

  useEffect(() => {
    peekNextReceiptNumber(database).then((n) => {
      setNextMin(n);
      setNextText(String(n).padStart(4, '0'));
    });
  }, []);

  if (!settings || nextMin == null) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Shop profile" />
      </View>
    );
  }

  const pickLogo = async () => {
    const picked = await pickOneFromGallery(LOGO_MAX_BYTES);
    if (picked === 'too-large') {
      Alert.alert('Logo too large', 'Pick an image of 1 MB or less.');
      return;
    }
    if (picked) save({ logoUri: picked.localUri });
  };

  // Checked when the field is left: it can be raised, never lowered.
  const saveNext = () => {
    const parsed = parseNextReceiptNumber(nextText, nextMin);
    if (!parsed.ok) {
      setNextError(parsed.error);
      setNextText(String(nextMin).padStart(4, '0'));
      return;
    }
    setNextError(undefined);
    setNextText(String(parsed.value).padStart(4, '0'));
    if (parsed.value !== nextMin) {
      setNextMin(parsed.value);
      save({ nextReceiptNumber: parsed.value });
    }
  };

  const currency = settings.currency || DEFAULT_CURRENCY;
  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? '';

  return (
    <View style={[styles.screen, { paddingBottom: keyboard }]}>
      <ScreenHeader title="Shop profile" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <Pressable
            onPress={pickLogo}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityRole="button"
            accessibilityLabel={settings.logoUri ? 'Change logo' : 'Add logo'}
          >
            <Logo uri={settings.logoUri} />
          </Pressable>
          <View style={styles.logoText}>
            <Text style={styles.logoTitle}>Logo</Text>
            <Text style={styles.logoHint}>On receipts and invoices</Text>
          </View>
          {settings.logoUri ? <TextAction label="Remove" onPress={() => save({ logoUri: '' })} /> : null}
          <TextAction label={settings.logoUri ? 'Change' : 'Add'} onPress={pickLogo} />
        </View>

        <Field
          label="Shop name"
          defaultValue={settings.shopName ?? ''}
          onChangeText={(v) => queue({ shopName: v.trim() })}
          placeholder="Your shop name"
          autoCapitalize="words"
        />
        <Field
          label="Phone"
          mono
          defaultValue={settings.shopPhone ?? ''}
          onChangeText={(v) => queue({ shopPhone: v.trim() })}
          placeholder="+234 803 555 0142"
          keyboardType="phone-pad"
        />
        <Field
          label="Address"
          area
          defaultValue={settings.shopAddress ?? ''}
          onChangeText={(v) => queue({ shopAddress: v.trim() })}
          placeholder="14 Allen Avenue, Ikeja"
          autoCapitalize="words"
        />

        <SectionLabel title="Receipts" />
        <Field
          label="Footer"
          area
          defaultValue={settings.receiptFooter ?? ''}
          onChangeText={(v) => queue({ receiptFooter: v.trim() })}
          placeholder="Goods not collected after 3 months may be disposed of."
        />
        <View style={styles.pair}>
          <Field
            label="Next number"
            flex
            mono
            prefix="R-"
            value={nextText}
            onChangeText={(v) => {
              setNextText(v.replace(/\D/g, ''));
              setNextError(undefined);
            }}
            onBlur={saveNext}
            onSubmitEditing={saveNext}
            keyboardType="number-pad"
            inputMode="numeric"
            returnKeyType="done"
          />
          <FieldButton label="Currency" flex>
            <Pressable
              style={({ pressed }) => [fieldBox, styles.select, pressed && styles.pressed]}
              onPress={() => setPickingCurrency(true)}
              accessibilityRole="button"
              accessibilityLabel={`Currency, ${currency}`}
            >
              <Text style={styles.selectText}>
                {currency} {symbol}
              </Text>
              <ChevronIcon width={16} height={16} color={colors.text} style={styles.down} />
            </Pressable>
          </FieldButton>
        </View>
        {nextError ? <Text style={styles.error}>{nextError}</Text> : null}

        <Text style={styles.note}>
          Changes are saved automatically. The next number can be raised to carry on from a paper receipt book, never
          lowered.
        </Text>
      </ScrollView>

      <ItemPickerSheet
        visible={pickingCurrency}
        title="Currency"
        options={currencyOptions}
        currentId={currency}
        onSelect={(id) => {
          setPickingCurrency(false);
          save({ currency: id });
        }}
        onClose={() => setPickingCurrency(false)}
      />
    </View>
  );
}

function Logo({ uri }: { uri?: string }) {
  const src = useImageSrc(uri ?? '');
  if (!uri || !src) return <View style={styles.logo} accessibilityLabel="No logo yet" />;
  return <Image source={{ uri: src }} style={styles.logo} accessibilityLabel="Shop logo" />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: space.xs },
  logo: {
    width: 64,
    height: 64,
    borderRadius: radius.card,
    backgroundColor: '#EFEBE3',
    borderWidth: 1,
    borderColor: colors.line,
  },
  logoText: { flex: 1 },
  logoTitle: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  logoHint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: 2 },
  pair: { flexDirection: 'row', gap: 10 },
  select: { justifyContent: 'space-between' },
  pressed: { opacity: 0.6 },
  selectText: { fontFamily: fonts.medium, fontSize: fontSizes.base, color: colors.text },
  down: { transform: [{ rotate: '90deg' }] },
  error: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.danger, marginTop: space.xs },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 14 },
});
