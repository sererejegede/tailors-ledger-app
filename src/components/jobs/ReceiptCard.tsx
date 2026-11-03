import { memo } from 'react';
import { Text, View } from 'react-native';
import type { ReceiptView } from '@/lib/receipt';
import { PaidInFullStamp, PaperItems, PaperPage, PaperParties, usePaperStyles } from './Paper';

/** The on-screen receipt: the same A5 layout as the PDF (receiptHtml). */

type Props = { view: ReceiptView; logoUri?: string; width: number };

function ReceiptCardBase({ view, logoUri, width }: Props) {
  const s = usePaperStyles(width);

  return (
    <PaperPage
      s={s}
      width={width}
      shopName={view.shopName}
      shopContact={view.shopContact}
      footer={view.footer}
      logoUri={logoUri}
    >
      <View style={s.row}>
        <Text style={s.heading}>RECEIPT</Text>
        <Text style={s.number}>{view.number}</Text>
      </View>
      <Text style={[s.small, s.right]}>{view.date}</Text>

      <PaperParties s={s} label="Received from" client={view.client} job={view.job} />
      <PaperItems s={s} items={view.items} total={view.total} />

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
        {view.paidInFull ? <PaidInFullStamp s={s} /> : <Text style={s.balanceAmount}>{view.balance}</Text>}
      </View>
      {view.collection ? (
        <View style={s.collection}>
          <Text style={s.text}>Collection</Text>
          <Text style={s.collectionDate}>{view.collection}</Text>
        </View>
      ) : null}
    </PaperPage>
  );
}

export const ReceiptCard = memo(ReceiptCardBase);
