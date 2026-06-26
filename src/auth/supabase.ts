import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config, isSupabaseConfigured } from '@/lib/config';

/**
 * Supabase auth client (Phase 4). Session is persisted in AsyncStorage and the access token
 * auto-refreshes from the long-lived refresh token, so after a one-time sign-in the app stays
 * authenticated offline (refresh happens when back online / on foreground). `null` until the
 * Supabase config is filled in — callers treat that as "sync not configured".
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // we handle the magic-link redirect ourselves (no web origin)
      },
    })
  : null;

// Supabase's guidance: only auto-refresh while the app is foregrounded.
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** The current access token (Bearer) for sync calls, or null when signed out/unconfigured. */
export async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
