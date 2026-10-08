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
  CommunicationDetailDto,
  CommunicationSummaryDto,
  CommunicationsService,
  ListCommunicationsQueryDto,
} from './communications.service';

@ApiTags('communications')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: AiErrorDto })
@ApiServiceUnavailableResponse({ type: AiErrorDto })
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communicationsService: CommunicationsService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'List the authenticated user boards' })
  @ApiOkResponse({ type: [CommunicationSummaryDto] })
  async list(
    @Query() query: ListCommunicationsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommunicationSummaryDto[]> {
    return this.communicationsService.list(
      request.user?.id ?? '',
      query.profileId,
    );
  }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get a board with fresh signed image URLs' })
  @ApiOkResponse({ type: CommunicationDetailDto })
  @ApiNotFoundResponse({ type: AiErrorDto })
  async get(
    @Param('id') communicationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CommunicationDetailDto> {
    return this.communicationsService.get(
      communicationId,
      request.user?.id ?? '',
    );
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a board' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async remove(
    @Param('id') communicationId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.communicationsService.remove(
      communicationId,
      request.user?.id ?? '',
    );
  }
}
