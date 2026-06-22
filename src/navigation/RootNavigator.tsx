import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Tabs from './Tabs';
import MeasurementEntryScreen from '@/features/measurement-entry/MeasurementEntryScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root stack. `Tabs` holds the top-level tab screens; `MeasurementEntry` (and, in 3b,
 * set detail / editors) sit here OUTSIDE the tabs so the bottom tab bar never shows
 * while measuring. The hero supplies its own header, so its native header is hidden.
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
    </Stack.Navigator>
  );
}
