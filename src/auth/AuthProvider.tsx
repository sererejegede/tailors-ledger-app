import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * Magic-link / OAuth redirect target. Must be added VERBATIM to the Supabase dashboard
 * (Authentication → URL Configuration → Redirect URLs). It uses the app's custom scheme
 * (`scheme` in app.json), so the auth flow reopens the app instead of the web Site URL.
 */
export const AUTH_REDIRECT = 'tailorsledger://auth-callback';

/** Adopt a session from a redirect URL — implicit flow (#access_token) or PKCE (?code). */
async function completeFromUrl(sb: SupabaseClient, url: string | null): Promise<void> {
  if (!url) return;
  if (url.includes('#')) {
    const frag = new URLSearchParams(url.split('#')[1]);
    const access_token = frag.get('access_token');
    const refresh_token = frag.get('refresh_token');
    if (access_token && refresh_token) {
      await sb.auth.setSession({ access_token, refresh_token });
      return;
    }
  }
  const query = url.includes('?') ? url.split('?')[1].split('#')[0] : '';
  const code = new URLSearchParams(query).get('code');
  if (code) await sb.auth.exchangeCodeForSession(code);
}

/**
 * App-wide auth state (Phase 4, opt-in sync). Holds the Supabase session and exposes
 * Google OAuth + passwordless magic-link sign-in (and sign-out). Signed out / unconfigured
 * is fine — the app works fully offline; sync just no-ops.
 */
type AuthApi = {
  session: Session | null;
  loading: boolean;
  /** False when Supabase isn't configured (extra keys empty) — UI shows a hint. */
  configured: boolean;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithMagicLink: (email: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthApi>({
  session: null,
  loading: false,
  configured: false,
  signInWithGoogle: async () => ({ error: 'Auth not available' }),
  signInWithMagicLink: async () => ({ error: 'Auth not available' }),
  signOut: async () => {},
});

export const useAuth = (): AuthApi => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));

  // Load the persisted session and subscribe to changes.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Adopt a magic-link deep-link redirect (OAuth completes inline via the web-auth session).
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;
    const handle = (url: string | null) => completeFromUrl(sb, url);
    Linking.getInitialURL().then(handle);
    const sub = Linking.addEventListener('url', (e) => handle(e.url));
    return () => sub.remove();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const sb = supabase;
    if (!sb) return { error: 'Sync isn’t configured yet.' };
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'Could not start Google sign-in.' };
    // Open the consent screen in an in-app browser; it returns to AUTH_REDIRECT on success.
    const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
    if (result.type === 'success' && result.url) {
      await completeFromUrl(sb, result.url);
    }
    return {}; // cancel/dismiss → silently stay signed out
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) return { error: 'Sync isn’t configured yet.' };
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: AUTH_REDIRECT },
    });
    return error ? { error: error.message } : {};
  }, []);

  const signOut = useCallback(async () => {
    await supabase?.auth.signOut();
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, loading, configured: Boolean(supabase), signInWithGoogle, signInWithMagicLink, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
