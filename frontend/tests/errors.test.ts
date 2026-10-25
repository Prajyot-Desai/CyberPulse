import { describe, it, expect } from 'vitest';
import { sanitizeErrorMessage } from '../src/utils/errors';

describe('sanitizeErrorMessage', () => {
  it('redacts Bearer tokens in error strings without leaking credentials', () => {
    const fakeToken = 'test-token-xyz-12345';
    const input = `Request failed: Authorization header Bearer ${fakeToken} was rejected by upstream`;
    const result = sanitizeErrorMessage(input);

    expect(result).not.toContain(fakeToken);
    expect(result).toContain('Bearer [REDACTED]');
    expect(result).toBe('Request failed: Authorization header Bearer [REDACTED] was rejected by upstream');
  });

  it('redacts token, secret, and authorization query parameters and key-values', () => {
    const fakeSecret = 'fake_super_secret_key_888';
    const fakeToken = 'fake_api_token_999';

    const input1 = `Upstream error fetching https://api.cloudflare.com/client/v4/radar?api_token=${fakeToken}&format=json`;
    const result1 = sanitizeErrorMessage(input1);
    expect(result1).not.toContain(fakeToken);
    expect(result1).toContain('api_token=[REDACTED]');

    const input2 = `Connection error: token=${fakeToken} with secret=${fakeSecret}`;
    const result2 = sanitizeErrorMessage(input2);
    expect(result2).not.toContain(fakeToken);
    expect(result2).not.toContain(fakeSecret);
    expect(result2).toContain('token=[REDACTED]');
    expect(result2).toContain('secret=[REDACTED]');

    const input3 = `Error detail: authorization=${fakeSecret} and key=${fakeToken}`;
    const result3 = sanitizeErrorMessage(input3);
    expect(result3).not.toContain(fakeSecret);
    expect(result3).not.toContain(fakeToken);
    expect(result3).toContain('authorization=[REDACTED]');
    expect(result3).toContain('key=[REDACTED]');
  });

  it('replaces raw Python tracebacks with clean user-safe messaging', () => {
    const rawTraceback = `Traceback (most recent call last):
  File "C:\\Users\\prajy\\CyberPulse\\backend\\app\\clients\\cloudflare.py", line 123, in _request
    raise CloudflareUpstreamError("Connection reset")
CloudflareUpstreamError: Connection reset`;

    const result = sanitizeErrorMessage(rawTraceback);

    expect(result).not.toContain('Traceback');
    expect(result).not.toContain('File "');
    expect(result).not.toContain('cloudflare.py');
    expect(result).toBe('The backend encountered an internal error. Please try again shortly.');
  });

  it('replaces raw HTML error pages with clean user-safe messaging', () => {
    const htmlDoctype = '<!DOCTYPE html><html><head><title>502 Bad Gateway</title></head><body>502 Bad Gateway</body></html>';
    const result1 = sanitizeErrorMessage(htmlDoctype);
    expect(result1).not.toContain('<!DOCTYPE html>');
    expect(result1).toBe('The backend encountered an internal error. Please try again shortly.');

    const htmlBodyOnly = '<html><body><h1>500 Internal Server Error</h1></body></html>';
    const result2 = sanitizeErrorMessage(htmlBodyOnly);
    expect(result2).not.toContain('<html>');
    expect(result2).toBe('The backend encountered an internal error. Please try again shortly.');
  });

  it('returns clean fallback on missing or non-string inputs', () => {
    const fallback = 'An unexpected error occurred while communicating with the service.';

    expect(sanitizeErrorMessage(null)).toBe(fallback);
    expect(sanitizeErrorMessage(undefined)).toBe(fallback);
    expect(sanitizeErrorMessage('')).toBe(fallback);
    expect(sanitizeErrorMessage('   ')).toBe(fallback);
    expect(sanitizeErrorMessage(12345)).toBe(fallback);
    expect(sanitizeErrorMessage({})).toBe(fallback);
    expect(sanitizeErrorMessage([])).toBe(fallback);
  });

  it('preserves ordinary safe error messages without mutation', () => {
    expect(sanitizeErrorMessage('Server error (HTTP 500)')).toBe('Server error (HTTP 500)');
    expect(
      sanitizeErrorMessage('Upstream Cloudflare Radar data unavailable: Connection timeout')
    ).toBe('Upstream Cloudflare Radar data unavailable: Connection timeout');
    expect(
      sanitizeErrorMessage("dateRange: String should match pattern '^(1d|7d|14d|30d)$'")
    ).toBe("dateRange: String should match pattern '^(1d|7d|14d|30d)$'");
  });
});
