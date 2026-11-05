import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import Tabs from './Tabs';
import MeasurementEntryScreen from '@/features/measurement-entry/MeasurementEntryScreen';
import ClientDetailScreen from '@/features/client-detail/ClientDetailScreen';
import ClientJobsScreen from '@/features/client-detail/ClientJobsScreen';
import SetDetailScreen from '@/features/set-detail/SetDetailScreen';
import TemplatesScreen from '@/features/templates/TemplatesScreen';
import TemplateEditorScreen from '@/features/templates/TemplateEditorScreen';
import NewJobScreen from '@/features/jobs/NewJobScreen';
import JobDetailScreen from '@/features/jobs/JobDetailScreen';
import ReceiptScreen from '@/features/jobs/ReceiptScreen';
import InvoiceScreen from '@/features/jobs/InvoiceScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Branded native header for the detail screens (back arrow + title). */
const detailHeader = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.bg },
  headerTintColor: colors.accent,
  headerTitleStyle: { fontFamily: fonts.titleSemi, color: colors.text },
  headerShadowVisible: false,
  animation: 'slide_from_right' as const,
};

/**
 * Root stack. `Tabs` holds the top-level tab screens; the measurement hero and the detail
 * screens (client / set / item history) sit here OUTSIDE the tabs so the bottom tab bar
 * never shows while measuring or drilling in. The hero supplies its own header.
 */
export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen
        name="MeasurementEntry"
        component={MeasurementEntryScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="ClientJobs" component={ClientJobsScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="SetDetail" component={SetDetailScreen} options={{ animation: 'slide_from_right' }} />
      {/* Draws its own ScreenHeader (Back + title), so the native header stays hidden. */}
      <Stack.Screen name="Templates" component={TemplatesScreen} options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="TemplateEditor" component={TemplateEditorScreen} options={detailHeader} />
      <Stack.Screen
        name="NewJob"
        component={NewJobScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} options={detailHeader} />
      <Stack.Screen name="Receipt" component={ReceiptScreen} options={detailHeader} />
      <Stack.Screen name="Invoice" component={InvoiceScreen} options={{ ...detailHeader, title: 'Invoice' }} />
    </Stack.Navigator>
  );
}
