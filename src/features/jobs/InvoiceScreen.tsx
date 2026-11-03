import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { database } from '@/db';
import { Alert } from '@/lib/alert';
import { invoiceView, type InvoiceSource } from '@/lib/invoice';
import { shareInvoice } from '@/lib/sharePdf';
import { invoiceSource, updateJob } from '@/repositories/jobs';
import { colors, radius, space, fontSizes } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import { CollectionDateSheet, InvoiceCard } from '@/components/jobs';
import PlusIcon from '@/assets/icons/plus.svg';
import type { RootStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Invoice'>;

const PAPER_BORDER = 1;

/**
 * The job's invoice, drawn from the job as it is now (nothing is saved). Opened from Job
 * detail; all of it works offline.
 */
export default function InvoiceScreen({ route }: Props) {
  const { jobId } = route.params;
  const insets = useSafeAreaInsets();
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

  const pickDate = async (collectOn: number) => {
    setPicking(false);
    await updateJob(database, jobId, { collectOn });
    load();
  };

  if (!view) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.preview}>
        {/* Measured, not the window: on web the app sits in a narrower column. */}
        <View style={styles.paper} onLayout={(e) => setWidth(e.nativeEvent.layout.width - PAPER_BORDER * 2)}>
          {width > 0 ? <InvoiceCard view={view} logoUri={logoUri} width={width} /> : null}
        </View>
      </ScrollView>

      <View style={[styles.actions, { paddingBottom: insets.bottom + space.lg }]}>
        {/* A due date only matters while something's owed. Adding is the only action; no remove. */}
        {view.paidInFull ? null : view.collection ? (
          <View style={styles.dated}>
            <Text style={styles.datedText}>
              Due on collection, <Text style={styles.datedDate}>{view.collection}</Text>
            </Text>
            <Pressable onPress={() => setPicking(true)} hitSlop={space.sm} accessibilityRole="button">
              <Text style={styles.change}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.addDate} onPress={() => setPicking(true)} accessibilityRole="button">
            <PlusIcon width={18} height={18} color={colors.accent} />
            <Text style={styles.addDateText}>Add collection date</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.share, sharing && styles.shareBusy]}
          onPress={share}
          disabled={sharing}
          accessibilityRole="button"
        >
          <Text style={styles.shareText}>Share</Text>
        </Pressable>
      </View>

      {picking ? <CollectionDateSheet onPick={pickDate} onClose={() => setPicking(false)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  preview: { paddingHorizontal: space.lg, paddingBottom: space.md },
  paper: { borderWidth: PAPER_BORDER, borderColor: colors.line },
  actions: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.sm },
  addDate: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.xs },
  addDateText: { fontFamily: fonts.semibold, fontSize: fontSizes.base, color: colors.accent },
  dated: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
  },
  datedText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.text },
  datedDate: { fontFamily: fonts.bold },
  change: { fontFamily: fonts.semibold, fontSize: fontSizes.sm, color: colors.accent },
  share: {
    height: 56,
    borderRadius: radius.default,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBusy: { opacity: 0.6 },
  shareText: { fontFamily: fonts.bold, fontSize: fontSizes.base, color: '#fff' },
});
