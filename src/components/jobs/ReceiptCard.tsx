import { memo, useMemo } from 'react';
import { Image, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import type { ReceiptView } from '@/lib/receipt';
import { useImageSrc } from '@/lib/imageSrc';
import { colors } from '@/theme/tokens';
import { fonts, valueText } from '@/theme/typography';

/**
 * The on-screen receipt: the same A5 layout as the PDF (receiptHtml), drawn in native views
 * and scaled to `width`, so the tailor sees what the client will get before sharing.
 */

const INK = '#2F3132';
const SOFT = '#6B675E';
const DESIGN_WIDTH = 559;
const DESIGN_HEIGHT = 794;

type Props = { view: ReceiptView; logoUri?: string; width: number };

function ReceiptCardBase({ view, logoUri, width }: Props) {
  const scale = width / DESIGN_WIDTH;
  const s = useMemo(() => scaledStyles(scale), [scale]);
  const logoSrc = useImageSrc(logoUri ?? '');

  return (
    <View style={[s.page, { width, minHeight: DESIGN_HEIGHT * scale }]}>
      <View style={s.shop}>
        {logoUri && logoSrc ? <Image source={{ uri: logoSrc }} style={s.logo} accessibilityLabel="Shop logo" /> : null}
        <Text style={s.shopName}>{view.shopName}</Text>
        {view.shopContact ? <Text style={s.small}>{view.shopContact}</Text> : null}
      </View>

      <View style={s.rule} />

      <View style={s.row}>
        <Text style={s.heading}>RECEIPT</Text>
        <Text style={s.number}>{view.number}</Text>
      </View>
      <Text style={[s.small, s.right]}>{view.date}</Text>

      <View style={s.parties}>
        <View style={s.party}>
          <Text style={s.small}>Received from</Text>
          <Text style={s.client}>{view.client}</Text>
        </View>
        {view.job ? (
          <View style={s.party}>
            <Text style={[s.small, s.right]}>Job</Text>
            <Text style={[s.text, s.right]}>{view.job}</Text>
          </View>
        ) : null}
      </View>

      <View style={s.itemsHead}>
        <Text style={s.itemsHeadText}>Items</Text>
        <Text style={s.itemsHeadText}>Amount</Text>
      </View>
      {view.items.map((item, index) => (
        <View key={index} style={s.item}>
          <Text style={s.itemName}>
            {item.name}
            {item.detail ? <Text style={s.small}>{`  ${item.detail}`}</Text> : null}
          </Text>
          <Text style={s.money}>{item.amount}</Text>
        </View>
      ))}
      <View style={s.total}>
        <Text style={s.strong}>Total</Text>
        <Text style={[s.money, s.strong]}>{view.total}</Text>
      </View>

      {view.voided ? (
        <View style={s.void}>
          <Text style={s.voidLabel}>VOID</Text>
          <Text style={s.voidAmount}>{view.amount}</Text>
        </View>
      ) : (
        <View style={s.received}>
          <View>
            <Text style={s.receivedSmall}>Amount received</Text>
            <Text style={s.receivedKind}>{view.kind}</Text>
          </View>
          <Text style={s.receivedAmount}>{view.amount}</Text>
        </View>
      )}

      <View style={s.paid}>
        <Text style={s.text}>Paid so far</Text>
        <Text style={s.money}>{view.paid}</Text>
      </View>
      <View style={s.balance}>
        <Text style={s.balanceLabel}>Balance</Text>
        {view.paidInFull ? (
          <View style={s.stamp}>
            <Text style={s.stampText}>PAID IN FULL</Text>
          </View>
        ) : (
          <Text style={s.balanceAmount}>{view.balance}</Text>
        )}
      </View>
      {view.collection ? (
        <View style={s.collection}>
          <Text style={s.text}>Collection</Text>
          <Text style={s.collectionDate}>{view.collection}</Text>
        </View>
      ) : null}

      {view.footer ? (
        <View style={s.footer}>
          <Text style={[s.small, s.center]}>{view.footer}</Text>
        </View>
      ) : null}
    </View>
  );
}

function scaledStyles(k: number) {
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
    total: { ...row, paddingTop: px(7) },
    received: {
      ...row,
      alignItems: 'center',
      marginTop: px(12),
      paddingVertical: px(11),
      paddingHorizontal: px(16),
      borderRadius: px(6),
      backgroundColor: colors.accentTint,
    },
    receivedSmall: text(12, { color: colors.accentInk }),
    receivedKind: text(14, { fontFamily: fonts.bold, color: colors.accentInk }),
    receivedAmount: money(28, { fontWeight: '700', color: colors.accentInk }),
    void: {
      ...row,
      alignItems: 'center',
      marginTop: px(12),
      paddingVertical: px(11),
      paddingHorizontal: px(16),
      borderRadius: px(6),
      borderWidth: 2,
      borderColor: colors.danger,
    },
    voidLabel: text(20, { fontFamily: fonts.bold, letterSpacing: px(3), color: colors.danger }),
    voidAmount: money(24, { color: colors.danger, textDecorationLine: 'line-through' }),
    paid: { ...row, paddingTop: px(10) },
    balance: { ...row, alignItems: 'center', paddingTop: px(4) },
    balanceLabel: text(17, { fontFamily: fonts.bold, color: INK }),
    balanceAmount: money(17, { fontWeight: '700', color: colors.accent }),
    stamp: { borderWidth: 2, borderColor: colors.accent, borderRadius: px(4), paddingHorizontal: px(10) },
    stampText: text(13, { fontFamily: fonts.bold, letterSpacing: px(1), color: colors.accent }),
    collection: { ...row, paddingTop: px(4) },
    collectionDate: text(14, { fontFamily: fonts.semibold }),
    footer: {
      marginTop: 'auto',
      paddingTop: px(10),
      borderTopWidth: 1,
      borderTopColor: colors.line2,
      borderStyle: 'dashed',
    },
  });
}

export const ReceiptCard = memo(ReceiptCardBase);
