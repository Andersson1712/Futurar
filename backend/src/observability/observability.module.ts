import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import type { LogLevelOption } from '../config/env.validation';
import { CorrelationInterceptor } from './correlation.interceptor';
import { HealthController } from './health.controller';
import { buildLoggerOptions, resolveLogLevel } from './logger.options';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

/**
 * SPEC-027: cross-cutting observability (global module). Structured JSON
 * request logs with correlation ids, global correlation echo + HTTP metrics
 * interceptors, health probe and metrics endpoint.
 */
@Global()
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildLoggerOptions(
          resolveLogLevel(config.get<LogLevelOption>('LOG_LEVEL')),
        ),
    }),
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: CorrelationInterceptor },
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
  ],
  exports: [MetricsService],
})
export class ObservabilityModule {}
