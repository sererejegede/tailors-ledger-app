import { registerRootComponent } from 'expo';

import { initSentry } from '@/lib/sentry';
import App from './App';

// Initialize error reporting before anything renders so startup crashes are caught (web
// only, gated to production + a configured DSN — see sentry.web.tsx).
initSentry();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
