import type { NavigatorScreenParams } from '@react-navigation/native';

/** Bottom tabs — top-level screens only (the tab bar never shows while measuring). */
export type TabsParamList = {
  Clients: undefined;
  Templates: undefined;
  Settings: undefined;
};

/**
 * Root native-stack. The measurement-entry hero (and, later, set detail / editors) live
 * here — OUTSIDE the tab navigator — so the bottom tabs disappear during a session.
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabsParamList>;
  MeasurementEntry: { setId: string };
  ClientDetail: { clientId: string };
  SetDetail: { setId: string };
  ItemHistory: { itemId: string; itemKey: string };
  TemplateEditor: { templateId?: string };
};
