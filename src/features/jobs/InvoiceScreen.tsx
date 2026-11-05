import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import { Alert } from '@/lib/alert';
import { invoiceView, type InvoiceSource } from '@/lib/invoice';
import { prepareInvoice, shareInvoice } from '@/lib/sharePaper';
import { invoiceSource, updateJob } from '@/repositories/jobs';
import { colors, fontSizes, radius, space } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { DueDateSheet, InvoiceCard } from '@/components/jobs';
import { BottomBar, Button, ScreenHeader, TextAction } from '@/components/ui';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Invoice'>;

const PAPER_BORDER = 1;

/**
 * The job's invoice, drawn from the job as it is now (nothing is saved), laid out like the
 * receipt: the paper, the due date under it with *Add collection date* or *Change*, and
 * *Share invoice* at the bottom. A date set here is saved to the job. All of it works offline.
 */
export default function InvoiceScreen({ route }: Props) {
  const { jobId } = route.params;
  const [width, setWidth] = useState(0);
  const [source, setSource] = useState<InvoiceSource | null>(null);
  const [logoUri, setLogoUri] = useState<string>();
  const [picking, setPicking] = useState(false);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    const loaded = await invoiceSource(database, jobId);
    setSource(loaded.source);
    setLogoUri(loaded.logoUri);
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const view = useMemo(() => source && invoiceView(source), [source]);

  useEffect(() => {
    if (view) prepareInvoice(view, logoUri);
  }, [view, logoUri]);

  const share = useCallback(async () => {
    if (!view || sharing) return;
    setSharing(true);
    try {
      await shareInvoice(view, logoUri);
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : String(e));
    } finally {
      setSharing(false);
    }
  }, [view, logoUri, sharing]);

  const saveDate = async (collectOn: number | null) => {
    setPicking(false);
    await updateJob(database, jobId, { collectOn });
    load();
  };

  if (!view) {
    return (
      <View style={styles.screen}>
        <ScreenHeader title="Invoice" />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScreenHeader title="Invoice" />
      <ScrollView contentContainerStyle={styles.preview}>
        {/* Measured, not the window: on web the app sits in a narrower column. */}
        <View style={styles.paper} onLayout={(e) => setWidth(e.nativeEvent.layout.width - PAPER_BORDER * 2)}>
          {width > 0 ? <InvoiceCard view={view} logoUri={logoUri} width={width} /> : null}
        </View>
        <Text style={styles.caption}>A5, as it will print</Text>

        {/* A due date only matters while something's owed. */}
        {view.paidInFull ? null : view.collection ? (
          <View style={styles.due}>
            <Text style={styles.dueText}>
              Due on collection, <Text style={styles.dueDate}>{view.collection}</Text>
            </Text>
            <TextAction label="Change" onPress={() => setPicking(true)} />
          </View>
        ) : (
          <TextAction label="Add collection date" onPress={() => setPicking(true)} style={styles.add} />
        )}
      </ScrollView>

      <BottomBar>
        <Button kind="primary" label={sharing ? 'Preparing…' : 'Share invoice'} onPress={share} disabled={sharing} />
      </BottomBar>

      {picking ? (
        <DueDateSheet collectOn={source?.collectOn ?? null} onSave={saveDate} onClose={() => setPicking(false)} />
      ) : null}
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
  due: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md, marginTop: space.sm },
  dueText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.text },
  dueDate: { fontFamily: fonts.bold },
  add: { alignSelf: 'center', marginTop: space.sm },
});
