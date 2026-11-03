import { useMemo, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useImageSrc } from '@/lib/imageSrc';
import { colors } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';

/**
 * What the on-screen receipt and invoice share: the A5 page (the same layout as paperHtml),
 * the shop's header, the items table and the footer, drawn in native views and scaled to
 * `width`, so the tailor sees what the client will get before sharing.
 */

const INK = '#2F3132';
const SOFT = '#6B675E';
const DESIGN_WIDTH = 559;
const DESIGN_HEIGHT = 794;

export type PaperStyles = ReturnType<typeof paperStyles>;

export function usePaperStyles(width: number): PaperStyles {
  const scale = width / DESIGN_WIDTH;
  return useMemo(() => paperStyles(scale), [scale]);
}

type PageProps = {
  s: PaperStyles;
  width: number;
  shopName: string;
  shopContact: string;
  footer: string;
  logoUri?: string;
  children: ReactNode;
};

export function PaperPage({ s, width, shopName, shopContact, footer, logoUri, children }: PageProps) {
  const logoSrc = useImageSrc(logoUri ?? '');
  return (
    <View style={[s.page, { width, minHeight: (DESIGN_HEIGHT * width) / DESIGN_WIDTH }]}>
      <View style={s.shop}>
        {logoUri && logoSrc ? <Image source={{ uri: logoSrc }} style={s.logo} accessibilityLabel="Shop logo" /> : null}
        <Text style={s.shopName}>{shopName}</Text>
        {shopContact ? <Text style={s.small}>{shopContact}</Text> : null}
      </View>

      <View style={s.rule} />

      {children}

      {footer ? (
        <View style={s.footer}>
          <Text style={[s.small, s.center]}>{footer}</Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * "Received from" / "Bill to" on the left, with the client's phone when there is one, and the
 * job on the right when it has a title.
 */
export function PaperParties({
  s,
  label,
  client,
  job,
  phone,
}: {
  s: PaperStyles;
  label: string;
  client: string;
  job: string | null;
  phone?: string | null;
}) {
  return (
    <View style={s.parties}>
      <View style={s.party}>
        <Text style={s.small}>{label}</Text>
        <Text style={s.client}>{client}</Text>
        {phone ? <Text style={s.small}>{phone}</Text> : null}
      </View>
      {job ? (
        <View style={s.party}>
          <Text style={[s.small, s.right]}>Job</Text>
          <Text style={[s.text, s.right]}>{job}</Text>
        </View>
      ) : null}
    </View>
  );
}

type Line = { name: string; detail: string; amount: string; pending?: boolean };

/** The items table, total row included. */
export function PaperItems({ s, items, total }: { s: PaperStyles; items: Line[]; total: string }) {
  return (
    <>
      <View style={s.itemsHead}>
        <Text style={s.itemsHeadText}>Items</Text>
        <Text style={s.itemsHeadText}>Amount</Text>
      </View>
      {items.map((item, index) => (
        <View key={index} style={s.item}>
          <Text style={s.itemName}>
            {item.name}
            {item.detail ? <Text style={s.small}>{`  ${item.detail}`}</Text> : null}
          </Text>
          <Text style={item.pending ? s.small : s.money}>{item.amount}</Text>
        </View>
      ))}
      <View style={s.total}>
        <Text style={s.strong}>Total</Text>
        <Text style={[s.money, s.strong]}>{total}</Text>
      </View>
    </>
  );
}

export function PaidInFullStamp({ s }: { s: PaperStyles }) {
  return (
    <View style={s.stamp}>
      <Text style={s.stampText}>PAID IN FULL</Text>
    </View>
  );
}

function paperStyles(k: number) {
  const px = (n: number) => n * k;
  const text = (size: number, extra: TextStyle = {}): TextStyle => ({
    fontFamily: fonts.body,
    fontSize: px(size),
    lineHeight: px(size * 1.45),
    color: colors.text,
    ...extra,
  });
  const money = (size: number, extra: TextStyle = {}): TextStyle => ({
    ...valueText,
    fontSize: px(size),
    lineHeight: px(size * 1.45),
    color: colors.text,
    ...extra,
  });
  const row: ViewStyle = { flexDirection: 'row', justifyContent: 'space-between' };
  const box: ViewStyle = {
    ...row,
    alignItems: 'center',
    marginTop: px(12),
    paddingVertical: px(11),
    paddingHorizontal: px(16),
    borderRadius: px(6),
  };

  return StyleSheet.create({
    page: {
      backgroundColor: colors.surface,
      paddingTop: px(36),
      paddingHorizontal: px(40),
      paddingBottom: px(28),
    },
    shop: { alignItems: 'center', gap: px(2) },
    logo: { width: px(60), height: px(60), borderRadius: px(30), marginBottom: px(6) },
    shopName: text(26, { fontFamily: fonts.title, color: colors.accent, textAlign: 'center' }),
    rule: { height: px(2), backgroundColor: colors.accent, marginTop: px(14), marginBottom: px(12) },
    row: { ...row, alignItems: 'baseline' },
    heading: text(13, { fontFamily: fonts.bold, letterSpacing: px(1.5) }),
    number: money(14, { fontWeight: '700', color: colors.accent }),
    small: text(12, { color: SOFT }),
    right: { textAlign: 'right' },
    center: { textAlign: 'center' },
    text: text(14),
    strong: text(14, { fontFamily: fonts.bold, color: INK }),
    parties: { flexDirection: 'row', gap: px(24), marginTop: px(6) },
    party: { flex: 1, minWidth: 0 },
    client: text(17, { fontFamily: fonts.semibold, color: INK }),
    itemsHead: {
      ...row,
      marginTop: px(14),
      paddingBottom: px(5),
      borderBottomWidth: 1,
      borderBottomColor: colors.text,
    },
    itemsHeadText: text(12, { fontFamily: fonts.bold }),
    item: {
      ...row,
      alignItems: 'baseline',
      gap: px(16),
      paddingVertical: px(6),
      borderBottomWidth: 1,
      borderBottomColor: colors.line,
    },
    itemName: text(14, { fontFamily: fonts.medium, color: INK, flex: 1 }),
    money: money(14),
    // Clear space before the total, about one item row's height (paperHtml's TOTAL_GAP).
    total: { ...row, marginTop: px(32), paddingTop: px(7) },
    // The tinted box: what was received on a receipt, the balance due on an invoice.
    received: { ...box, backgroundColor: colors.accentTint },
    receivedSmall: text(12, { color: colors.accentInk }),
    receivedKind: text(14, { fontFamily: fonts.bold, color: colors.accentInk }),
    receivedAmount: money(28, { fontWeight: '700', color: colors.accentInk }),
    void: { ...box, borderWidth: 2, borderColor: colors.danger },
    voidLabel: text(20, { fontFamily: fonts.bold, letterSpacing: px(3), color: colors.danger }),
    voidAmount: money(24, { color: colors.danger, textDecorationLine: 'line-through' }),
    settled: { ...box, borderWidth: 1, borderColor: colors.line2 },
    paid: { ...row, paddingTop: px(10) },
    balance: { ...row, alignItems: 'center', paddingTop: px(4) },
    balanceLabel: text(17, { fontFamily: fonts.bold, color: INK }),
    balanceAmount: money(17, { fontWeight: '700', color: colors.accent }),
    stamp: { borderWidth: 2, borderColor: colors.accent, borderRadius: px(4), paddingHorizontal: px(10) },
    stampText: text(13, { fontFamily: fonts.bold, letterSpacing: px(1), color: colors.accent }),
    collection: { ...row, paddingTop: px(4) },
    collectionDate: text(14, { fontFamily: fonts.semibold }),
    bank: {
      marginTop: px(14),
      paddingVertical: px(10),
      paddingHorizontal: px(16),
      borderWidth: 1,
      borderColor: colors.line2,
      borderRadius: px(6),
    },
    bankTitle: text(12, { fontFamily: fonts.bold, letterSpacing: px(0.5), marginBottom: px(4) }),
    bankRow: { flexDirection: 'row', gap: px(12) },
    bankLabel: text(14, { color: SOFT, width: px(120) }),
    bankValue: text(14, { fontFamily: fonts.medium, color: INK, flex: 1 }),
    bankNumber: money(14, { fontWeight: '700', color: INK, flex: 1 }),
    footer: {
      marginTop: 'auto',
      paddingTop: px(10),
      borderTopWidth: 1,
      borderTopColor: colors.line2,
      borderStyle: 'dashed',
    },
  });
}
