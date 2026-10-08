import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AiErrorDto } from '../common/dto/ai-error.dto';
import {
  SupabaseAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/supabase-auth.guard';
import {
  ListPresentationsQueryDto,
  PresentationDetailDto,
  PresentationSummaryDto,
  PresentationsService,
} from './presentations.service';

@ApiTags('presentations')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: AiErrorDto })
@ApiServiceUnavailableResponse({ type: AiErrorDto })
@Controller('presentations')
export class PresentationsController {
  constructor(private readonly presentationsService: PresentationsService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'List the authenticated user presentations' })
  @ApiOkResponse({ type: [PresentationSummaryDto] })
  async list(
    @Query() query: ListPresentationsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<PresentationSummaryDto[]> {
    return this.presentationsService.list(
      request.user?.id ?? '',
      query.profileId,
    );
  }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get a presentation with fresh signed image URLs' })
  @ApiOkResponse({ type: PresentationDetailDto })
  @ApiNotFoundResponse({ type: AiErrorDto })
  async get(
    @Param('id') presentationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<PresentationDetailDto> {
    return this.presentationsService.get(
      presentationId,
      request.user?.id ?? '',
    );
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a presentation' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async remove(
    @Param('id') presentationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.presentationsService.remove(
      presentationId,
      request.user?.id ?? '',
    );
  }
}
