import type { PinoLogger } from 'nestjs-pino';

/** Silent PinoLogger stand-in for unit tests. */
export function fakePinoLogger(): PinoLogger {
  const noop = (): void => undefined;

  return {
    setContext: noop,
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
  } as unknown as PinoLogger;
}
