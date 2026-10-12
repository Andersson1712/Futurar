import { Injectable } from '@nestjs/common';
import { AiProviderError } from '../ai.errors';

export const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
export const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000;

@Injectable()
export class CircuitBreaker {
  private failures = 0;
  private openedAt?: number;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new AiProviderError(
        'PROVIDER_UNAVAILABLE',
        'Circuit breaker is open',
      );
    }

    try {
      const result = await operation();
      this.failures = 0;
      this.openedAt = undefined;
      return result;
    } catch (error) {
      this.failures += 1;

      if (this.failures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
        this.openedAt = Date.now();
      }

      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.openedAt === undefined) return false;

    if (Date.now() - this.openedAt >= CIRCUIT_BREAKER_COOLDOWN_MS) {
      this.openedAt = undefined;
      this.failures = 0;
      return false;
    }

    return true;
  }
}
