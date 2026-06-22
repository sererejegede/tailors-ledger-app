import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { database } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { useAppFonts } from '@/theme/typography';
import { colors } from '@/theme/tokens';
import RootNavigator from '@/navigation/RootNavigator';

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.accent },
};

/**
 * App shell: load brand fonts + seed the local store, then mount the navigation tree
 * (DatabaseProvider → NavigationContainer → RootNavigator). Replaces the Phase-1 smoke
 * screen. Sync is still Phase 4 — everything here runs against the local store.
 */
export default function App() {
  const fontsLoaded = useAppFonts();
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    ensureSeeded(database)
      .catch((e) => console.error('[seed] failed', e))
      .finally(() => setSeeded(true));
  }, []);

  if (!fontsLoaded || !seeded) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <DatabaseProvider database={database}>
        <NavigationContainer theme={navTheme}>
          <StatusBar style="dark" />
          <RootNavigator />
        </NavigationContainer>
      </DatabaseProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
