import { memo } from 'react';
import { Text, View } from 'react-native';
import type { InvoiceView } from '@/lib/invoice';
import { PaidInFullStamp, PaperItems, PaperPage, PaperParties, usePaperStyles } from './Paper';

/** The on-screen invoice: the same A5 layout as the PDF (invoiceHtml). */

type Props = { view: InvoiceView; logoUri?: string; width: number };

function InvoiceCardBase({ view, logoUri, width }: Props) {
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
        <Text style={s.heading}>INVOICE</Text>
        <Text style={s.small}>{view.date}</Text>
      </View>

      <PaperParties s={s} label="Bill to" client={view.client} phone={view.clientPhone} job={view.job} />
      <PaperItems s={s} items={view.items} total={view.total} />
      {view.unpriced ? <Text style={[s.small, s.right]}>{view.unpriced}</Text> : null}
      {view.paid ? (
        <View style={s.paid}>
          <Text style={s.text}>Paid so far</Text>
          <Text style={s.money}>{view.paid}</Text>
        </View>
      ) : null}

      {view.paidInFull ? (
        <View style={s.settled}>
          <Text style={s.strong}>Balance</Text>
          <PaidInFullStamp s={s} />
        </View>
      ) : (
        <View style={s.received}>
          <View>
            <Text style={s.receivedKind}>Balance due</Text>
            {view.collection ? <Text style={s.receivedSmall}>Due on collection, {view.collection}</Text> : null}
          </View>
          <Text style={s.receivedAmount}>{view.balance}</Text>
        </View>
      )}

      {view.bank.length ? (
        <View style={s.bank}>
          <Text style={s.bankTitle}>Pay by bank transfer</Text>
          {view.bank.map((line) => (
            <View key={line.label} style={s.bankRow}>
              <Text style={s.bankLabel}>{line.label}</Text>
              <Text style={line.number ? s.bankNumber : s.bankValue}>{line.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </PaperPage>
  );
}

export const InvoiceCard = memo(InvoiceCardBase);
