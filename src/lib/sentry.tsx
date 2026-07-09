import type { ReactNode } from 'react';

/**
 * Native builds don't report to Sentry yet (web-only for now — see sentry.web.tsx). These
 * are no-ops so shared callers (index.ts, App, the sync logger) stay platform-agnostic.
 */
export function initSentry(): void {}

export function captureError(_error: unknown, _context?: Record<string, unknown>): void {}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
