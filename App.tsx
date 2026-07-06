import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { DatabaseProvider } from '@nozbe/watermelondb/react';
import { database } from '@/db';
import { ensureSeeded } from '@/db/seed';
import { getSettings } from '@/repositories/settings';
import { useAppFonts } from '@/theme/typography';
import { FontScaleProvider } from '@/theme/textScale';
import { colors } from '@/theme/tokens';
import RootNavigator from '@/navigation/RootNavigator';
import { linking } from '@/navigation/linking';
import { OverlayHostProvider } from '@/components/OverlayHost';
import { SnackbarProvider } from '@/components/Snackbar';
import { AppLockGate } from '@/components/AppLockGate';
import { AuthProvider } from '@/auth/AuthProvider';
import { SyncProvider } from '@/sync';

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.accent },
};

/**
 * App shell: load brand fonts + seed the local store + read local settings (text size,
 * app lock), then mount the navigation tree. Sync is still Phase 4 — everything here runs
 * against the local store.
 */
export default function App() {
  const fontsLoaded = useAppFonts();
  const [ready, setReady] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [appLockEnabled, setAppLockEnabled] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await ensureSeeded(database);
        const s = await getSettings(database);
        setLargeText(s?.textSize === 'large');
        setAppLockEnabled(s?.appLockEnabled ?? false);
      } catch (e) {
        console.error('[startup] failed', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  if (!fontsLoaded || !ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <FontScaleProvider initialLarge={largeText}>
          <DatabaseProvider database={database}>
            <AuthProvider>
              <SyncProvider>
                <OverlayHostProvider>
                  <SnackbarProvider>
                    <AppLockGate enabled={appLockEnabled}>
                      <NavigationContainer theme={navTheme} linking={linking}>
                        <StatusBar style="dark" />
                        <RootNavigator />
                      </NavigationContainer>
                    </AppLockGate>
                  </SnackbarProvider>
                </OverlayHostProvider>
              </SyncProvider>
            </AuthProvider>
          </DatabaseProvider>
        </FontScaleProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
