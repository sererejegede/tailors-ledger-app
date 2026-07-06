import * as Linking from 'expo-linking';
import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * URL / browser-history integration. On web this is what makes each in-app navigation push a
 * real history entry, so the PWA's back gesture (Android system back → `history.back()`)
 * walks back through the app instead of closing it, and only exits at the Clients index.
 * Pressing back on a detail screen pops the stack — the same action as its top-left back
 * arrow. Harmless on native, where it also enables `tailorsledger://` deep links.
 *
 * Screens with complex/union params (MeasurementEntry) keep a plain base path; their params
 * ride along as query string, which is all we need for history to work.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/')],
  config: {
    screens: {
      Tabs: {
        screens: {
          Clients: '', // index — back here exits the app
          Templates: 'templates',
          Settings: 'settings',
        },
      },
      MeasurementEntry: 'measure',
      ClientDetail: 'client/:clientId',
      SetDetail: 'set/:setId',
      TemplateEditor: 'template',
    },
  },
};
