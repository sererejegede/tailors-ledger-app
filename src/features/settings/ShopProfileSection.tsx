import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type AppSettings from '@/db/models/AppSettings';
import { pickManyFromGallery } from '@/lib/images';
import { useImageSrc } from '@/lib/imageSrc';
import { CURRENCIES, DEFAULT_CURRENCY, formatReceiptNumber } from '@/lib/money';
import type { SettingsPatch } from '@/repositories/settings';
import { colors, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { PromptModal } from '@/components/PromptModal';
import { SettingsHeading } from '@/components/SettingsHeading';
import { SettingsRow } from '@/components/SettingsRow';
import { ItemPickerSheet } from '@/components/templates';

/**
 * The shop's details, printed on every receipt (data-model §3). All of it stays on this
 * phone. A receipt freezes these when it's saved, except the logo, which is a local file.
 */

type TextField = 'shopName' | 'shopPhone' | 'shopAddress' | 'receiptFooter';

const TEXT_FIELDS: {
  field: TextField;
  title: string;
  placeholder: string;
  keyboardType?: 'phone-pad';
  multiline?: boolean;
}[] = [
  { field: 'shopName', title: 'Shop name', placeholder: 'Your shop name' },
  { field: 'shopPhone', title: 'Phone', placeholder: '+234 803 555 0142', keyboardType: 'phone-pad' },
  { field: 'shopAddress', title: 'Address', placeholder: '14 Allen Avenue, Ikeja' },
  {
    field: 'receiptFooter',
    title: 'Receipt footer',
    placeholder: 'Goods not collected after 3 months may be disposed of.',
    multiline: true,
  },
];

const currencyOptions = CURRENCIES.map((c) => ({ id: c.code as string, name: `${c.symbol} ${c.name}` }));

type Props = {
  settings: AppSettings;
  /** The number the next receipt will really get, which can be above the stored setting. */
  nextReceiptNumber: number;
  onPatch: (patch: SettingsPatch) => void;
};

export function ShopProfileSection({ settings, nextReceiptNumber, onPatch }: Props) {
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState<TextField | 'nextReceiptNumber' | null>(null);
  const [numberError, setNumberError] = useState<string>();
  const [pickingCurrency, setPickingCurrency] = useState(false);

  const pickLogo = useCallback(async () => {
    const [picked] = await pickManyFromGallery(1);
    if (picked) onPatch({ logoUri: picked.localUri });
  }, [onPatch]);

  const closeEditor = useCallback(() => {
    setEditing(null);
    setNumberError(undefined);
  }, []);

  const saveNumber = (value: string) => {
    const n = Number(value.trim());
    if (!Number.isInteger(n) || n < 1) {
      setNumberError('Enter a whole number above 0.');
      return;
    }
    onPatch({ nextReceiptNumber: n });
    closeEditor();
  };

  const currency = settings.currency || DEFAULT_CURRENCY;
  const textField = TEXT_FIELDS.find((f) => f.field === editing);

  return (
    <>
      <SettingsHeading title="Shop profile" />

      <View style={styles.logoRow}>
        <LogoPreview uri={settings.logoUri} />
        <View style={styles.logoText}>
          <Text style={styles.logoTitle}>Logo</Text>
          <Text style={styles.logoHint}>Shown on receipts</Text>
        </View>
        {settings.logoUri ? (
          <Pressable onPress={() => onPatch({ logoUri: '' })} hitSlop={space.sm}>
            <Text style={styles.remove}>Remove</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={pickLogo} hitSlop={space.sm}>
          <Text style={styles.change}>{settings.logoUri ? 'Change' : 'Add'}</Text>
        </Pressable>
      </View>

      {TEXT_FIELDS.map((f) => (
        <SettingsRow
          key={f.field}
          title={f.title}
          value={settings[f.field] ?? ''}
          onPress={() => setEditing(f.field)}
        />
      ))}
      <SettingsRow
        title="Next receipt number"
        value={formatReceiptNumber(nextReceiptNumber)}
        onPress={() => setEditing('nextReceiptNumber')}
      />
      <SettingsRow
        title="Currency"
        value={currencyOptions.find((c) => c.id === currency)?.name ?? currency}
        onPress={() => setPickingCurrency(true)}
      />

      <PromptModal
        visible={!!textField}
        title={textField?.title ?? ''}
        placeholder={textField?.placeholder}
        initialValue={textField ? (settings[textField.field] ?? '') : ''}
        multilineInput={textField?.multiline}
        keyboardType={textField?.keyboardType}
        onCancel={closeEditor}
        onSubmit={(value) => {
          if (textField) onPatch({ [textField.field]: value });
          closeEditor();
        }}
      />
      <PromptModal
        visible={editing === 'nextReceiptNumber'}
        title="Next receipt number"
        message="Set this to carry on from a paper receipt book. It can't go below your last receipt."
        initialValue={String(nextReceiptNumber)}
        keyboardType="numeric"
        inputMode="numeric"
        error={numberError}
        onCancel={closeEditor}
        onSubmit={saveNumber}
      />
      <ItemPickerSheet
        visible={pickingCurrency}
        options={currencyOptions}
        currentId={currency}
        onSelect={(id) => {
          onPatch({ currency: id });
          setPickingCurrency(false);
        }}
        onClose={() => setPickingCurrency(false)}
        bottomInset={insets.bottom}
      />
    </>
  );
}

function LogoPreview({ uri }: { uri?: string }) {
  const src = useImageSrc(uri ?? '');
  if (!uri || !src) return <View style={styles.logoEmpty} />;
  return <Image source={{ uri: src }} style={styles.logo} accessibilityLabel="Shop logo" />;
}

const LOGO_SIZE = 56;

const styles = StyleSheet.create({
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: LOGO_SIZE / 2 },
  logoEmpty: { width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: LOGO_SIZE / 2, backgroundColor: colors.accentTint },
  logoText: { flex: 1 },
  logoTitle: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.text },
  logoHint: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.muted },
  change: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.accent },
  remove: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.muted },
});
