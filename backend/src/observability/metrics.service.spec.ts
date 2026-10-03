import { MetricsService } from './metrics.service';

describe('MetricsService (SPEC-027)', () => {
  it('starts empty', () => {
    const snapshot = new MetricsService().snapshot();

    expect(snapshot.requests.total).toBe(0);
    expect(snapshot.generation.jobs).toBe(0);
    expect(snapshot.generation.averageLatencyMs).toBe(0);
  });

  it('counts HTTP requests by status family and averages latency', () => {
    const metrics = new MetricsService();

    metrics.recordHttpRequest(200, 100);
    metrics.recordHttpRequest(201, 300);
    metrics.recordHttpRequest(422, 200);
    metrics.recordHttpRequest(500, 400);

    const snapshot = metrics.snapshot();
    expect(snapshot.requests.total).toBe(4);
    expect(snapshot.requests.byStatus).toMatchObject({
      '2xx': 2,
      '4xx': 1,
      '5xx': 1,
    });
    expect(snapshot.requests.averageLatencyMs).toBe(250);
  });

  it('tracks generation outcomes, latency and token usage', () => {
    const metrics = new MetricsService();

    metrics.recordGeneration({
      success: true,
      latencyMs: 1_000,
      inputTokens: 500,
      outputTokens: 1_500,
    });
    metrics.recordGeneration({ success: false, latencyMs: 3_000 });

    const snapshot = metrics.snapshot();
    expect(snapshot.generation.jobs).toBe(2);
    expect(snapshot.generation.succeeded).toBe(1);
    expect(snapshot.generation.failed).toBe(1);
    expect(snapshot.generation.averageLatencyMs).toBe(2_000);
    expect(snapshot.generation.inputTokens).toBe(500);
    expect(snapshot.generation.outputTokens).toBe(1_500);
  });
});
