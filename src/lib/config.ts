import Constants from 'expo-constants';

/**
 * Phase-4 sync config, read from `app.json` → `expo.extra` (see those keys). The Supabase
 * anon key is the public, RLS-protected key — safe to ship. Until these are filled in, the
 * auth + sync features stay inert (the app is offline-first and fully usable without them).
 */
const extra = (Constants.expoConfig?.extra ?? {}) as {
  backendBaseUrl?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

export const config = {
  /** Base path of the sync API, e.g. https://api.example.com/v1 (no trailing slash). */
  backendBaseUrl: (extra.backendBaseUrl ?? '').replace(/\/$/, ''),
  supabaseUrl: extra.supabaseUrl ?? '',
  supabaseAnonKey: extra.supabaseAnonKey ?? '',
};

export const isSupabaseConfigured = Boolean(config.supabaseUrl && config.supabaseAnonKey);
export const isBackendConfigured = Boolean(config.backendBaseUrl);
