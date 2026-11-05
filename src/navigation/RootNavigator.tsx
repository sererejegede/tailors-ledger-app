import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Tabs from './Tabs';
import MeasurementEntryScreen from '@/features/measurement-entry/MeasurementEntryScreen';
import ClientDetailScreen from '@/features/client-detail/ClientDetailScreen';
import ClientJobsScreen from '@/features/client-detail/ClientJobsScreen';
import SetDetailScreen from '@/features/set-detail/SetDetailScreen';
import ShopProfileScreen from '@/features/settings/ShopProfileScreen';
import PaymentDetailsScreen from '@/features/settings/PaymentDetailsScreen';
import TemplatesScreen from '@/features/templates/TemplatesScreen';
import TemplateEditorScreen from '@/features/templates/TemplateEditorScreen';
import NewJobScreen from '@/features/jobs/NewJobScreen';
import JobDetailScreen from '@/features/jobs/JobDetailScreen';
import ReceiptScreen from '@/features/jobs/ReceiptScreen';
import InvoiceScreen from '@/features/jobs/InvoiceScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root stack. `Tabs` holds the top-level tab screens; the measurement hero and the detail
 * screens (client / set / item history) sit here OUTSIDE the tabs so the bottom tab bar
 * never shows while measuring or drilling in. Every screen draws its own header (Back and the
 * title, or a tab's big title), so the navigator's header stays hidden.
 */
export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="MeasurementEntry" component={MeasurementEntryScreen} />
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} />
      <Stack.Screen name="ClientJobs" component={ClientJobsScreen} />
      <Stack.Screen name="SetDetail" component={SetDetailScreen} />
      <Stack.Screen name="ShopProfile" component={ShopProfileScreen} />
      <Stack.Screen name="PaymentDetails" component={PaymentDetailsScreen} />
      <Stack.Screen name="Templates" component={TemplatesScreen} />
      <Stack.Screen name="TemplateEditor" component={TemplateEditorScreen} />
      <Stack.Screen name="NewJob" component={NewJobScreen} />
      <Stack.Screen name="JobDetail" component={JobDetailScreen} />
      <Stack.Screen name="Receipt" component={ReceiptScreen} />
      <Stack.Screen name="Invoice" component={InvoiceScreen} />
    </Stack.Navigator>
  );
}
