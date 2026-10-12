import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../common/guards/supabase-auth.guard';
import { MetricsService } from './metrics.service';
import type { MetricsSnapshot } from './metrics.service';

/**
 * SPEC-027: in-memory counters as JSON. Teacher auth required; counters
 * reset on restart by design (persistent series are a follow-up).
 */
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({
    summary: 'In-memory operational metrics (resets on restart)',
  })
  @ApiOkResponse()
  snapshot(): MetricsSnapshot {
    return this.metrics.snapshot();
  }
}
