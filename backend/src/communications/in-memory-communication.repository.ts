import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CommunicationRepository,
  SaveCommunicationInput,
  StoredCommunication,
  StoredCommunicationSummary,
} from './communication.repository';

interface InMemoryCommunication {
  summary: StoredCommunicationSummary;
  communication: StoredCommunication;
}

@Injectable()
export class InMemoryCommunicationRepository implements CommunicationRepository {
  private readonly communications = new Map<string, InMemoryCommunication>();
  private readonly jobIndex = new Map<string, string>();

  save(input: SaveCommunicationInput): Promise<StoredCommunication> {
    const jobId = input.audit.generationJobId;

    if (jobId) {
      const existingId = this.jobIndex.get(jobId);

      if (existingId) {
        return Promise.resolve(
          this.communications.get(existingId)!.communication,
        );
      }
    }

    const now = new Date();
    const id = randomUUID();
    const version = {
      version: 1,
      title: input.snapshot.title,
      kind: input.snapshot.kind,
      topic: input.snapshot.topic,
      style: input.snapshot.style,
      audience: input.snapshot.audience,
      cellCount: input.snapshot.cellCount,
      cells: input.snapshot.cells,
      audit: input.audit,
      createdAt: now,
    };
    const summary: StoredCommunicationSummary = {
      id,
      userId: input.userId,
      profileId: input.profileId,
      title: input.snapshot.title,
      kind: input.snapshot.kind,
      cellCount: input.snapshot.cellCount,
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    const communication: StoredCommunication = { ...summary, version };

    this.communications.set(id, { summary, communication });

    if (jobId) {
      this.jobIndex.set(jobId, id);
    }

    return Promise.resolve(communication);
  }

  findById(
    communicationId: string,
    userId: string,
  ): Promise<StoredCommunication | undefined> {
    const stored = this.communications.get(communicationId);

    if (!stored || stored.summary.userId !== userId) {
      return Promise.resolve(undefined);
    }

    if (stored.summary.deletedAt) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve(stored.communication);
  }

  listByUser(
    userId: string,
    profileId?: string,
  ): Promise<StoredCommunicationSummary[]> {
    const summaries = [...this.communications.values()]
      .map((stored) => stored.summary)
      .filter(
        (summary) =>
          summary.userId === userId &&
          !summary.deletedAt &&
          (profileId === undefined || summary.profileId === profileId),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 100);

    return Promise.resolve(summaries);
  }

  softDelete(communicationId: string, userId: string): Promise<boolean> {
    const stored = this.communications.get(communicationId);

    if (
      !stored ||
      stored.summary.userId !== userId ||
      stored.summary.deletedAt
    ) {
      return Promise.resolve(false);
    }

    const deletedAt = new Date();
    stored.summary.deletedAt = deletedAt;
    stored.summary.updatedAt = deletedAt;
    stored.communication.deletedAt = deletedAt;
    stored.communication.updatedAt = deletedAt;

    return Promise.resolve(true);
  }
}
