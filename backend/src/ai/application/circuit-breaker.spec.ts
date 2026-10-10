import { AiProviderError } from '../ai.errors';
import {
  CIRCUIT_BREAKER_COOLDOWN_MS,
  CIRCUIT_BREAKER_FAILURE_THRESHOLD,
  CircuitBreaker,
} from './circuit-breaker';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('passes results through and resets failures on success', async () => {
    const breaker = new CircuitBreaker();
    const operation = jest.fn().mockResolvedValue('ok');

    await expect(breaker.execute(operation)).resolves.toBe('ok');
    await expect(breaker.execute(operation)).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it('opens after the failure threshold and rejects fast', async () => {
    const breaker = new CircuitBreaker();
    const failing = jest.fn().mockRejectedValue(new Error('provider down'));

    for (
      let attempt = 0;
      attempt < CIRCUIT_BREAKER_FAILURE_THRESHOLD;
      attempt++
    ) {
      await expect(breaker.execute(failing)).rejects.toThrow('provider down');
    }

    const blocked = jest.fn();
    await expect(breaker.execute(blocked)).rejects.toMatchObject({
      code: 'PROVIDER_UNAVAILABLE',
    });
    expect(blocked).not.toHaveBeenCalled();
  });

  it('recovers after the cooldown', async () => {
    const breaker = new CircuitBreaker();
    const failing = jest.fn().mockRejectedValue(new Error('provider down'));

    for (
      let attempt = 0;
      attempt < CIRCUIT_BREAKER_FAILURE_THRESHOLD;
      attempt++
    ) {
      await expect(breaker.execute(failing)).rejects.toThrow();
    }

    jest.setSystemTime(Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS + 1);

    const recovered = jest.fn().mockResolvedValue('back');
    await expect(breaker.execute(recovered)).resolves.toBe('back');
    expect(recovered).toHaveBeenCalled();
  });

  it('resets the failure count after an intervening success', async () => {
    const breaker = new CircuitBreaker();
    const failing = jest.fn().mockRejectedValue(new Error('provider down'));

    await expect(breaker.execute(failing)).rejects.toThrow();
    await expect(
      breaker.execute(jest.fn().mockResolvedValue('ok')),
    ).resolves.toBe('ok');

    for (
      let attempt = 0;
      attempt < CIRCUIT_BREAKER_FAILURE_THRESHOLD - 1;
      attempt++
    ) {
      await expect(breaker.execute(failing)).rejects.toThrow();
    }

    const stillAllowed = jest.fn().mockResolvedValue('ok');
    await expect(breaker.execute(stillAllowed)).resolves.toBe('ok');
  });

  it('throws AiProviderError when open', async () => {
    const breaker = new CircuitBreaker();
    const failing = jest.fn().mockRejectedValue(new Error('down'));

    for (
      let attempt = 0;
      attempt < CIRCUIT_BREAKER_FAILURE_THRESHOLD;
      attempt++
    ) {
      await breaker.execute(failing).catch(() => undefined);
    }

    const error = await breaker
      .execute(jest.fn())
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiProviderError);
  });
});
