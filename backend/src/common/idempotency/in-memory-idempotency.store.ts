import { Injectable } from '@nestjs/common';
import {
  IdempotencyStore,
  StoredIdempotentResponse,
} from './idempotency-store';

@Injectable()
export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, StoredIdempotentResponse>();

  get(scope: string): StoredIdempotentResponse | undefined {
    const entry = this.entries.get(scope);

    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(scope);
      return undefined;
    }

    return entry;
  }

  set(scope: string, entry: StoredIdempotentResponse): void {
    this.removeExpired();
    this.entries.set(scope, entry);
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
