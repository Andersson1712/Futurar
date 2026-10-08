import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  MessageEvent,
  Optional,
  Param,
  Post,
  Req,
  Sse,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import {
  ApiAcceptedResponse,
  ApiBadGatewayResponse,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { requestCorrelationId } from '../observability/correlation-id';
import { AiErrorDto } from '../common/dto/ai-error.dto';
import { AiErrorException } from '../common/errors/ai-error.exception';
import {
  SupabaseAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/supabase-auth.guard';
import {
  IDEMPOTENCY_KEY_HEADER,
  IdempotencyInterceptor,
} from '../common/interceptors/idempotency.interceptor';
import { BOOK_GENERATION_USE_CASE } from './application/book-generation.use-case';
import type { BookGenerationUseCase } from './application/book-generation.use-case';
import { DESIGN_GENERATION_USE_CASE } from './application/design-generation.use-case';
import type { DesignGenerationUseCase } from './application/design-generation.use-case';
import { PRESENTATION_GENERATION_USE_CASE } from './application/presentation-generation.use-case';
import type { PresentationGenerationUseCase } from './application/presentation-generation.use-case';
import { JobStatusStream } from './application/job-status.stream';
import { GenerateBookRequestDto } from './dto/generate-book-request.dto';
import { GenerateDesignRequestDto } from './dto/generate-design-request.dto';
import { GeneratePresentationRequestDto } from './dto/generate-presentation-request.dto';
import {
  GenerateBookResponseDto,
  JobStatusDto,
} from './dto/generate-book-response.dto';
import { AiEndpointsEnabledGuard } from './guards/ai-endpoints-enabled.guard';

@ApiTags('ai')
@ApiBearerAuth()
@Controller('ai')
export class AiController {
  constructor(
    @Inject(BOOK_GENERATION_USE_CASE)
    private readonly bookGeneration: BookGenerationUseCase,
    // Optional so pre-existing standalone AiController test modules (books)
    // keep resolving without the design provider; AiModule always provides
    // it, and the handler below degrades to 501 when it is absent.
    @Optional()
    @Inject(DESIGN_GENERATION_USE_CASE)
    private readonly designGeneration: DesignGenerationUseCase | undefined,
    // Optional so pre-existing standalone AiController test modules (books,
    // designs) keep resolving without the presentation provider; AiModule
    // always provides it, and the handler below degrades to 501 when absent.
    @Optional()
    @Inject(PRESENTATION_GENERATION_USE_CASE)
    private readonly presentationGeneration:
      PresentationGenerationUseCase | undefined,
    private readonly jobStatusStream: JobStatusStream,
  ) {}

  @Post('books/generate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(AiEndpointsEnabledGuard, SupabaseAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request AI book generation' })
  @ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: true,
    description: 'Unique 8-128 character key for this request',
  })
  @ApiAcceptedResponse({ type: GenerateBookResponseDto })
  @ApiBadRequestResponse({ type: AiErrorDto })
  @ApiConflictResponse({ type: AiErrorDto })
  @ApiUnprocessableEntityResponse({ type: AiErrorDto })
  @ApiBadGatewayResponse({ type: AiErrorDto })
  @ApiTooManyRequestsResponse({ type: AiErrorDto })
  @ApiServiceUnavailableResponse({ type: AiErrorDto })
  async generate(
    @Body() dto: GenerateBookRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GenerateBookResponseDto> {
    return this.bookGeneration.requestGeneration({
      ...dto,
      userId: request.user?.id ?? '',
      correlationId: requestCorrelationId(request),
    });
  }

  @Post('designs/generate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(AiEndpointsEnabledGuard, SupabaseAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request AI flyer design generation' })
  @ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: true,
    description: 'Unique 8-128 character key for this request',
  })
  @ApiAcceptedResponse({ type: GenerateBookResponseDto })
  @ApiBadRequestResponse({ type: AiErrorDto })
  @ApiConflictResponse({ type: AiErrorDto })
  @ApiUnprocessableEntityResponse({ type: AiErrorDto })
  @ApiBadGatewayResponse({ type: AiErrorDto })
  @ApiTooManyRequestsResponse({ type: AiErrorDto })
  @ApiServiceUnavailableResponse({ type: AiErrorDto })
  async generateDesign(
    @Body() dto: GenerateDesignRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GenerateBookResponseDto> {
    if (!this.designGeneration) {
      throw new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        'Design endpoints are disabled',
      );
    }

    return this.designGeneration.requestGeneration({
      ...dto,
      userId: request.user?.id ?? '',
      correlationId: requestCorrelationId(request),
    });
  }

  @Post('presentations/generate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(AiEndpointsEnabledGuard, SupabaseAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request AI presentation generation' })
  @ApiHeader({
    name: IDEMPOTENCY_KEY_HEADER,
    required: true,
    description: 'Unique 8-128 character key for this request',
  })
  @ApiAcceptedResponse({ type: GenerateBookResponseDto })
  @ApiBadRequestResponse({ type: AiErrorDto })
  @ApiConflictResponse({ type: AiErrorDto })
  @ApiUnprocessableEntityResponse({ type: AiErrorDto })
  @ApiBadGatewayResponse({ type: AiErrorDto })
  @ApiTooManyRequestsResponse({ type: AiErrorDto })
  @ApiServiceUnavailableResponse({ type: AiErrorDto })
  async generatePresentation(
    @Body() dto: GeneratePresentationRequestDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GenerateBookResponseDto> {
    if (!this.presentationGeneration) {
      throw new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        'Presentation endpoints are disabled',
      );
    }

    return this.presentationGeneration.requestGeneration({
      ...dto,
      userId: request.user?.id ?? '',
      correlationId: requestCorrelationId(request),
    });
  }

  @Get('jobs/:id')
  @UseGuards(AiEndpointsEnabledGuard, SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get generation job status' })
  @ApiOkResponse({ type: JobStatusDto })
  @ApiNotFoundResponse({ type: AiErrorDto })
  @ApiServiceUnavailableResponse({ type: AiErrorDto })
  async getJob(
    @Param('id') jobId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<JobStatusDto> {
    return this.bookGeneration.getJobStatus(jobId, request.user?.id ?? '');
  }

  @Sse('jobs/:id/events')
  @UseGuards(AiEndpointsEnabledGuard, SupabaseAuthGuard)
  @ApiOperation({ summary: 'Stream job status events (SSE)' })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ type: JobStatusDto })
  @ApiNotFoundResponse({ type: AiErrorDto })
  @ApiServiceUnavailableResponse({ type: AiErrorDto })
  async streamJob(
    @Param('id') jobId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Observable<MessageEvent>> {
    return this.jobStatusStream.open(jobId, request.user?.id ?? '');
  }
}
