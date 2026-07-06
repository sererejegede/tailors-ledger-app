import { config } from '@/lib/config';
import {
  SyncHttpError,
  type PullRequest,
  type PullResponse,
  type PushRequest,
  type PushResponse,
  type SyncTransport,
} from './types';

/**
 * HTTP transport for the two sync RPCs (contract §5/§6). `backendBaseUrl` already includes
 * the `/v1` prefix (app.json → expo.extra), so endpoints are `${base}/sync/pull|push`.
 * Non-2xx responses become a `SyncHttpError` carrying the status (and `Retry-After` for
 * 429) so the client can run the §10 matrix. The transport itself stays dumb: no retries,
 * no cursor logic — that's the client's job, which keeps it trivially mockable in tests.
 */

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : undefined;
}

async function rpc<T>(path: string, body: unknown, token: string): Promise<T> {
  const url = `${config.backendBaseUrl}${path}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    // Network failure (offline / DNS / timeout). Treated as a retryable 0 so a sync that
    // started just as connectivity dropped backs off instead of crashing the loop.
    const message = e instanceof Error ? e.message : 'network request failed';
    throw new SyncHttpError(0, message);
  }

  if (!response.ok) {
    let message = `${path} failed (${response.status})`;
    try {
      const text = await response.text();
      if (text) message = text;
    } catch {
      /* body not readable — keep the status message */
    }
    throw new SyncHttpError(
      response.status,
      message,
      parseRetryAfter(response.headers.get('Retry-After')),
    );
  }

  return (await response.json()) as T;
}

export const httpTransport: SyncTransport = {
  pull(req: PullRequest, token: string) {
    return rpc<PullResponse>('/sync/pull', req, token);
  },
  push(req: PushRequest, token: string) {
    return rpc<PushResponse>('/sync/push', req, token);
  },
};
