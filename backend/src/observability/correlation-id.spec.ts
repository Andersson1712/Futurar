import type { Request } from 'express';
import {
  CORRELATION_ID_HEADER,
  requestCorrelationId,
  resolveCorrelationId,
} from './correlation-id';

describe('correlation-id (SPEC-027)', () => {
  it('honors a well-formed incoming correlation id', () => {
    expect(resolveCorrelationId('abc-123_X.y:z~')).toBe('abc-123_X.y:z~');
  });

  it('trims surrounding whitespace', () => {
    expect(resolveCorrelationId('  abc  ')).toBe('abc');
  });

  it('uses the first value when the header repeats', () => {
    expect(resolveCorrelationId(['first', 'second'])).toBe('first');
  });

  it.each([undefined, '', '   ', 'has spaces', 'a'.repeat(129)])(
    'generates a UUID for %p',
    (header) => {
      const resolved = resolveCorrelationId(header);

      expect(resolved).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    },
  );

  it('reads the pino-http request id as the correlation id', () => {
    const request = { id: 'req-1', headers: {} } as unknown as Request;

    expect(requestCorrelationId(request)).toBe('req-1');
    expect(CORRELATION_ID_HEADER).toBe('x-correlation-id');
  });

  it('falls back to a UUID when the request has no id yet', () => {
    const request = { headers: {} } as unknown as Request;

    expect(requestCorrelationId(request)).toMatch(/^[0-9a-f-]{36}$/);
  });
});
