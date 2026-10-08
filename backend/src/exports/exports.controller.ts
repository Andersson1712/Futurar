import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
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
import { BOOK_STORAGE } from '../books/book-storage.port';
import type { BookStorage } from '../books/book-storage.port';
import { EXPORT_GENERATION_USE_CASE } from '../ai/application/export-generation.use-case';
import type { ExportGenerationUseCase } from '../ai/application/export-generation.use-case';
import { RequestExportDto } from '../ai/dto/request-export.dto';
import { GenerateBookResponseDto } from '../ai/dto/generate-book-response.dto';
import { JOB_REPOSITORY } from '../jobs/job.repository';
import type { JobRepository } from '../jobs/job.repository';
import { EXPORT_DOWNLOAD_TTL_SECONDS } from '../ai/domain/export-generation.types';
import { buildExportArtifactPath } from '../ai/application/export-generation.runner';
import { AiEndpointsEnabledGuard } from '../ai/guards/ai-endpoints-enabled.guard';

export class ExportDownloadDto {
  downloadUrl!: string;
}

@ApiTags('exports')
@ApiBearerAuth()
@Controller('exports')
export class ExportsController {
  constructor(
    // Optional so pre-existing standalone test modules keep resolving
    // without the export provider; AiModule always provides it, and the
    // handler below degrades to 501 when it is absent.
    @Optional()
    @Inject(EXPORT_GENERATION_USE_CASE)
    private readonly exportGeneration: ExportGenerationUseCase | undefined,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    @Inject(BOOK_STORAGE) private readonly storage: BookStorage,
  ) {}

  @Post('books/:id')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(AiEndpointsEnabledGuard, SupabaseAuthGuard)
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Request a book export (async job)' })
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
  async requestBookExport(
    @Param('id') bookId: string,
    @Body() dto: RequestExportDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<GenerateBookResponseDto> {
    if (!this.exportGeneration) {
      throw new AiErrorException(
        501,
        'NOT_IMPLEMENTED',
        'Export endpoints are disabled',
      );
    }

    return this.exportGeneration.requestExport({
      ...dto,
      bookId,
      userId: request.user?.id ?? '',
      correlationId: requestCorrelationId(request),
    });
  }

  @Get(':jobId/download')
  @UseGuards(AiEndpointsEnabledGuard, SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get a short-lived download URL for an export' })
  @ApiOkResponse({ type: ExportDownloadDto })
  @ApiNotFoundResponse({ type: AiErrorDto })
  @ApiServiceUnavailableResponse({ type: AiErrorDto })
  async download(
    @Param('jobId') jobId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ExportDownloadDto> {
    const userId = request.user?.id ?? '';
    const job = await this.jobs.find(jobId, userId);

    if (!job) {
      throw new AiErrorException(404, 'NOT_FOUND', 'Export job not found');
    }

    if (job.status !== 'completed') {
      throw new AiErrorException(
        409,
        'JOB_NOT_READY',
        'The export is not ready yet',
      );
    }

    const downloadUrl = await this.storage.signedUrl(
      buildExportArtifactPath(userId, jobId),
      EXPORT_DOWNLOAD_TTL_SECONDS,
    );

    return { downloadUrl };
  }
}
