import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '@/theme/tokens';
import { fonts } from '@/theme/typography';
import ClientsScreen from '@/features/clients/ClientsScreen';
import TemplatesScreen from '@/features/templates/TemplatesScreen';
import SettingsScreen from '@/features/settings/SettingsScreen';
import type { TabsParamList } from './types';

const Tab = createBottomTabNavigator<TabsParamList>();

/**
 * Top-level bottom tabs: Clients · Templates · Settings. These appear only on top-level
 * screens — the measurement-entry hero lives in the parent stack, so the tab bar is
 * absent while measuring (hero rule). Labels only for now (no icon dependency).
 */
export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line2 },
      }}
    >
      <Tab.Screen name="Clients" component={ClientsScreen} />
      <Tab.Screen name="Templates" component={TemplatesScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
