import { Injectable } from '@nestjs/common';
import {
  IdempotencyStore,
  StoredIdempotentResponse,
} from './idempotency-store';

@Injectable()
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, StoredIdempotentResponse>();

  get(scope: string): Promise<StoredIdempotentResponse | undefined> {
    const entry = this.entries.get(scope);

    if (!entry) return Promise.resolve(undefined);

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(scope);
      return Promise.resolve(undefined);
    }

    return Promise.resolve(entry);
  }

  set(scope: string, entry: StoredIdempotentResponse): Promise<void> {
    this.removeExpired();
    this.entries.set(scope, entry);

    return Promise.resolve();
  }

  private removeExpired(): void {
    const now = Date.now();

    for (const [scope, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(scope);
      }
    }
  }
}
