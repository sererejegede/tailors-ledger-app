import { redactString, deepRedact } from '../redact';

/**
 * Redaction guards what leaves the device via Sentry. If these ever regress, tokens/emails
 * or raw server bodies could be shipped to the error tracker — so they're locked down here.
 */
describe('redactString', () => {
  it('scrubs a JWT', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjMifQ.abc-DEF_123';
    expect(redactString(`token=${jwt}`)).toBe('token=[redacted-jwt]');
  });

  it('scrubs a Bearer token', () => {
    expect(redactString('Authorization: Bearer sk_live_abc.DEF-123')).toContain('Bearer [redacted]');
    expect(redactString('Authorization: Bearer sk_live_abc.DEF-123')).not.toContain('sk_live_abc');
  });

  it('scrubs emails', () => {
    expect(redactString('signed in as tunde@example.com now')).toBe('signed in as [redacted-email] now');
  });

  it('leaves ordinary text untouched', () => {
    expect(redactString('sync failed (500) at /sync/push')).toBe('sync failed (500) at /sync/push');
  });
});

describe('deepRedact', () => {
  it('walks nested objects and arrays', () => {
    const event = {
      message: 'hi tunde@example.com',
      extra: { headers: ['Bearer tok_abcDEF123'], nested: { note: 'ok' } },
    };
    const out = deepRedact(event);
    expect(out.message).toBe('hi [redacted-email]');
    expect(out.extra.headers[0]).toContain('Bearer [redacted]');
    expect(out.extra.nested.note).toBe('ok');
  });
});
