import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import Tabs from './Tabs';
import MeasurementEntryScreen from '@/features/measurement-entry/MeasurementEntryScreen';
import ClientDetailScreen from '@/features/client-detail/ClientDetailScreen';
import SetDetailScreen from '@/features/set-detail/SetDetailScreen';
import ItemHistoryScreen from '@/features/item-history/ItemHistoryScreen';
import TemplateEditorScreen from '@/features/templates/TemplateEditorScreen';
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
      <Stack.Screen name="ClientDetail" component={ClientDetailScreen} options={detailHeader} />
      <Stack.Screen name="SetDetail" component={SetDetailScreen} options={detailHeader} />
      <Stack.Screen name="ItemHistory" component={ItemHistoryScreen} options={detailHeader} />
      <Stack.Screen name="TemplateEditor" component={TemplateEditorScreen} options={detailHeader} />
    </Stack.Navigator>
  );
}
