import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  DesignRepository,
  SaveDesignInput,
  StoredDesign,
  StoredDesignSummary,
} from './design.repository';

interface InMemoryDesign {
  summary: StoredDesignSummary;
  design: StoredDesign;
}

@Injectable()
export class InMemoryDesignRepository implements DesignRepository {
  private readonly designs = new Map<string, InMemoryDesign>();
  private readonly jobIndex = new Map<string, string>();

  save(input: SaveDesignInput): Promise<StoredDesign> {
    const jobId = input.audit.generationJobId;

    if (jobId) {
      const existingId = this.jobIndex.get(jobId);

      if (existingId) {
        return Promise.resolve(this.designs.get(existingId)!.design);
      }
    }

    const now = new Date();
    const id = randomUUID();
    const version = {
      version: 1,
      title: input.snapshot.title,
      message: input.snapshot.message,
      occasion: input.snapshot.occasion,
      style: input.snapshot.style,
      audience: input.snapshot.audience,
      imagePath: input.snapshot.imagePath,
      imagePrompt: input.snapshot.imagePrompt,
      audit: input.audit,
      createdAt: now,
    };
    const summary: StoredDesignSummary = {
      id,
      userId: input.userId,
      profileId: input.profileId,
      title: input.snapshot.title,
      occasion: input.snapshot.occasion,
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    const design: StoredDesign = { ...summary, version };

    this.designs.set(id, { summary, design });

    if (jobId) {
      this.jobIndex.set(jobId, id);
    }

    return Promise.resolve(design);
  }

  findById(
    designId: string,
    userId: string,
  ): Promise<StoredDesign | undefined> {
    const stored = this.designs.get(designId);

    if (!stored || stored.summary.userId !== userId) {
      return Promise.resolve(undefined);
    }

    if (stored.summary.deletedAt) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve(stored.design);
  }

  listByUser(
    userId: string,
    profileId?: string,
  ): Promise<StoredDesignSummary[]> {
    const summaries = [...this.designs.values()]
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

  softDelete(designId: string, userId: string): Promise<boolean> {
    const stored = this.designs.get(designId);

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
    stored.design.deletedAt = deletedAt;
    stored.design.updatedAt = deletedAt;

    return Promise.resolve(true);
  }
}
