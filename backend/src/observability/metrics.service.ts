import { Injectable } from '@nestjs/common';

export interface GenerationRecord {
  success: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  // SPEC-033: per-response OpenRouter cost in USD. Recorded only when the
  // caller threads provider usage through (runners still pass tokens only).
  costUsd?: number;
}

export interface MetricsSnapshot {
  requests: {
    total: number;
    byStatus: Record<string, number>;
    averageLatencyMs: number;
  };
  generation: {
    jobs: number;
    succeeded: number;
    failed: number;
    averageLatencyMs: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
}

/**
 * SPEC-027: minimal in-memory metrics. Counters reset on restart by design
 * (documented on the endpoint); persistent series are a follow-up.
 */
@Injectable()
export class MetricsService {
  private httpTotal = 0;
  private readonly httpByStatus: Record<string, number> = {};
  private httpLatencySumMs = 0;

  private generationJobs = 0;
  private generationSucceeded = 0;
  private generationFailed = 0;
  private generationLatencySumMs = 0;
  private generationInputTokens = 0;
  private generationOutputTokens = 0;
  private generationCostUsd = 0;

  recordHttpRequest(statusCode: number, durationMs: number): void {
    this.httpTotal += 1;
    const family = `${Math.floor(statusCode / 100)}xx`;
    this.httpByStatus[family] = (this.httpByStatus[family] ?? 0) + 1;
    this.httpLatencySumMs += Math.max(0, durationMs);
  }

  recordGeneration(record: GenerationRecord): void {
    this.generationJobs += 1;

    if (record.success) {
      this.generationSucceeded += 1;
    } else {
      this.generationFailed += 1;
    }

    this.generationLatencySumMs += Math.max(0, record.latencyMs);
    this.generationInputTokens += Math.max(0, record.inputTokens ?? 0);
    this.generationOutputTokens += Math.max(0, record.outputTokens ?? 0);
    this.generationCostUsd += Math.max(0, record.costUsd ?? 0);
  }

  snapshot(): MetricsSnapshot {
    return {
      requests: {
        total: this.httpTotal,
        byStatus: { ...this.httpByStatus },
        averageLatencyMs:
          this.httpTotal === 0 ? 0 : this.httpLatencySumMs / this.httpTotal,
      },
      generation: {
        jobs: this.generationJobs,
        succeeded: this.generationSucceeded,
        failed: this.generationFailed,
        averageLatencyMs:
          this.generationJobs === 0
            ? 0
            : this.generationLatencySumMs / this.generationJobs,
        inputTokens: this.generationInputTokens,
        outputTokens: this.generationOutputTokens,
        costUsd: this.generationCostUsd,
      },
    };
  }
}
