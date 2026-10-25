/**
 * Error sanitization and presentation utilities.
 * Ensures user-facing messages are descriptive without leaking secrets, internal paths, or tokens.
 */

const BEARER_PATTERN = /Bearer\s+([A-Za-z0-9_\-\.]+)/gi;
const TOKEN_PARAM_PATTERN = /(api[_-]?token|token|authorization|secret|key)=([A-Za-z0-9_\-\.]+)/gi;

/**
 * Sanitize an error message to guarantee no credentials or internal stack dumps are displayed.
 */
export function sanitizeErrorMessage(message: unknown): string {
  if (!message || typeof message !== 'string') {
    return 'An unexpected error occurred while communicating with the service.';
  }

  const trimmed = message.trim();
  if (!trimmed) {
    return 'An unexpected error occurred while communicating with the service.';
  }

  // Mask tokens and authorization headers
  let clean = trimmed.replace(BEARER_PATTERN, 'Bearer [REDACTED]');
  clean = clean.replace(TOKEN_PARAM_PATTERN, '$1=[REDACTED]');

  // Check for internal stack traces, python tracebacks, or raw HTML error pages
  if (
    clean.includes('Traceback (most recent call last)') ||
    clean.includes('File "') ||
    clean.includes('<!DOCTYPE html>') ||
    clean.includes('<html')
  ) {
    return 'The backend encountered an internal error. Please try again shortly.';
  }

  return clean;
}
