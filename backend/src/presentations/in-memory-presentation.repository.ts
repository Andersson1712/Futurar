import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  PresentationRepository,
  SavePresentationInput,
  StoredPresentation,
  StoredPresentationSummary,
} from './presentation.repository';

interface InMemoryPresentation {
  summary: StoredPresentationSummary;
  presentation: StoredPresentation;
}

@Injectable()
export class InMemoryPresentationRepository implements PresentationRepository {
  private readonly presentations = new Map<string, InMemoryPresentation>();
  private readonly jobIndex = new Map<string, string>();

  save(input: SavePresentationInput): Promise<StoredPresentation> {
    const jobId = input.audit.generationJobId;

    if (jobId) {
      const existingId = this.jobIndex.get(jobId);

      if (existingId) {
        return Promise.resolve(
          this.presentations.get(existingId)!.presentation,
        );
      }
    }

    const now = new Date();
    const id = randomUUID();
    const version = {
      version: 1,
      title: input.snapshot.title,
      topic: input.snapshot.topic,
      style: input.snapshot.style,
      audience: input.snapshot.audience,
      slideCount: input.snapshot.slideCount,
      slides: input.snapshot.slides,
      audit: input.audit,
      createdAt: now,
    };
    const summary: StoredPresentationSummary = {
      id,
      userId: input.userId,
      profileId: input.profileId,
      title: input.snapshot.title,
      topic: input.snapshot.topic,
      slideCount: input.snapshot.slideCount,
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
    };
    const presentation: StoredPresentation = { ...summary, version };

    this.presentations.set(id, { summary, presentation });

    if (jobId) {
      this.jobIndex.set(jobId, id);
    }

    return Promise.resolve(presentation);
  }

  findById(
    presentationId: string,
    userId: string,
  ): Promise<StoredPresentation | undefined> {
    const stored = this.presentations.get(presentationId);

    if (!stored || stored.summary.userId !== userId) {
      return Promise.resolve(undefined);
    }

    if (stored.summary.deletedAt) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve(stored.presentation);
  }

  listByUser(
    userId: string,
    profileId?: string,
  ): Promise<StoredPresentationSummary[]> {
    const summaries = [...this.presentations.values()]
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

  softDelete(presentationId: string, userId: string): Promise<boolean> {
    const stored = this.presentations.get(presentationId);

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
    stored.presentation.deletedAt = deletedAt;
    stored.presentation.updatedAt = deletedAt;

    return Promise.resolve(true);
  }
}
