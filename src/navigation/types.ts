import type { NavigatorScreenParams } from '@react-navigation/native';
import type { JobFilter } from '@/lib/jobBoard';

/** Bottom tabs — top-level screens only (the tab bar never shows while measuring). */
export type TabsParamList = {
  Clients: undefined;
  // The home tiles open it already filtered.
  Jobs: { filter?: JobFilter } | undefined;
  Settings: undefined;
};

/**
 * Root native-stack. The measurement-entry hero (and, later, set detail / editors) live
 * here — OUTSIDE the tab navigator — so the bottom tabs disappear during a session.
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabsParamList>;
  // Re-measure opens an existing set; a NEW measurement passes a templateId (+ optional
  // clientId for client-first) and creates rows only on save — see createSetWithMeasurements.
  MeasurementEntry: { setId: string } | { templateId: string; clientId?: string; label?: string };
  ClientDetail: { clientId: string };
  // All of one client's jobs (S2a).
  ClientJobs: { clientId: string };
  SetDetail: { setId: string };
  // Opens from Settings; no longer a tab.
  Templates: undefined;
  TemplateEditor: { templateId?: string };
  // Starts a job; the next payment on a job is a sheet on JobDetail.
  RecordPayment: { clientId: string };
  JobDetail: { jobId: string };
  Receipt: { paymentId: string };
  // Drawn from the job each time; nothing about an invoice is saved.
  Invoice: { jobId: string };
};
