import pino from 'pino';
import { buildLoggerOptions, resolveLogLevel } from './logger.options';

describe('logger.options (SPEC-027)', () => {
  it('defaults to info level', () => {
    expect(resolveLogLevel(undefined)).toBe('info');
    expect(resolveLogLevel('debug')).toBe('debug');
  });

  it('redacts credential headers while keeping the correlation id', () => {
    const options = buildLoggerOptions('info');
    const redact = (
      options.pinoHttp as { redact: { paths: string[]; censor: string } }
    ).redact;

    expect(redact.paths).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
      ]),
    );

    const chunks: string[] = [];
    const stream = { write: (line: string) => chunks.push(line) };
    const logger = pino({ redact }, stream);
    logger.info({
      req: {
        headers: {
          authorization: 'Bearer super-secret-token',
          cookie: 'session=abc',
          'x-correlation-id': 'corr-1',
        },
      },
    });

    const logged = chunks.join('');
    expect(logged).not.toContain('super-secret-token');
    expect(logged).not.toContain('session=abc');
    expect(logged).toContain('[Redacted]');
    expect(logged).toContain('corr-1');
  });
});
