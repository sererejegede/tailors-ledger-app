/**
 * Redaction for anything sent to Sentry. Sync error messages can carry the server's raw
 * response body, and the auth flow carries tokens/emails — none of that should leave the
 * device. Applied in the Sentry `beforeSend` hook (sentry.web.tsx). Kept dependency-free so
 * it's trivially unit-testable.
 */

const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const BEARER = /Bearer\s+[\w.\-~+/]+=*/gi;
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

/** Scrub JWTs, Bearer tokens, and emails from a single string. */
export function redactString(input: string): string {
  return input
    .replace(JWT, '[redacted-jwt]')
    .replace(BEARER, 'Bearer [redacted]')
    .replace(EMAIL, '[redacted-email]');
}

/** Recursively redact every string inside a value (strings/arrays/objects), in place. */
export function deepRedact<T>(value: T): T {
  if (typeof value === 'string') return redactString(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => deepRedact(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    for (const key of Object.keys(obj)) obj[key] = deepRedact(obj[key]);
  }
  return value;
}
