import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import ClientsScreen from '@/features/clients/ClientsScreen';
import TemplatesScreen from '@/features/templates/TemplatesScreen';
import SettingsScreen from '@/features/settings/SettingsScreen';
import { TabBar } from './TabBar';
import type { TabsParamList } from './types';

const Tab = createBottomTabNavigator<TabsParamList>();

/**
 * Top-level bottom tabs: Clients · Templates · Settings. These appear only on top-level
 * screens — the measurement-entry hero lives in the parent stack, so the tab bar is
 * absent while measuring (hero rule). Uses a custom TabBar (SVG icons + maroon active pill).
 */
export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tab.Screen name="Clients" component={ClientsScreen} />
      <Tab.Screen name="Templates" component={TemplatesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
