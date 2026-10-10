import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CredentialMetadata,
  CredentialProvider,
  CredentialRepository,
  SaveCredentialInput,
  StoredCredential,
} from './credential.repository';

interface InMemoryRecord extends StoredCredential {
  status: 'active' | 'revoked';
}

@Injectable()
export class InMemoryCredentialRepository implements CredentialRepository {
  private readonly records: InMemoryRecord[] = [];

  save(input: SaveCredentialInput): Promise<CredentialMetadata> {
    const now = new Date();
    const record: InMemoryRecord = {
      id: randomUUID(),
      ownerId: input.ownerId,
      tenantId: input.tenantId,
      provider: input.provider,
      encrypted: input.encrypted,
      keyHint: input.keyHint,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };

    // Store the new key first, then revoke previous ones (no downtime).
    this.records.push(record);

    for (const previous of this.records) {
      if (
        previous.id !== record.id &&
        previous.ownerId === input.ownerId &&
        previous.provider === input.provider &&
        previous.status === 'active'
      ) {
        previous.status = 'revoked';
        previous.rotatedAt = now;
        previous.updatedAt = now;
      }
    }

    return Promise.resolve(toMetadata(record));
  }

  findActive(
    ownerId: string,
    provider: CredentialProvider,
  ): Promise<StoredCredential | undefined> {
    const active = this.records
      .filter(
        (record) =>
          record.ownerId === ownerId &&
          record.provider === provider &&
          record.status === 'active',
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

    return Promise.resolve(active ? { ...active } : undefined);
  }

  list(ownerId: string): Promise<CredentialMetadata[]> {
    const list = this.records
      .filter((record) => record.ownerId === ownerId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(toMetadata);

    return Promise.resolve(list);
  }

  revoke(ownerId: string, provider: CredentialProvider): Promise<boolean> {
    const active = this.records.filter(
      (record) =>
        record.ownerId === ownerId &&
        record.provider === provider &&
        record.status === 'active',
    );

    if (active.length === 0) return Promise.resolve(false);

    const now = new Date();
    for (const record of active) {
      record.status = 'revoked';
      record.updatedAt = now;
    }

    return Promise.resolve(true);
  }
}

function toMetadata(record: InMemoryRecord): CredentialMetadata {
  return {
    id: record.id,
    provider: record.provider,
    keyHint: record.keyHint,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    rotatedAt: record.rotatedAt,
  };
}
