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
  DesignDetailDto,
  DesignSummaryDto,
  DesignsService,
  ListDesignsQueryDto,
} from './designs.service';

@ApiTags('designs')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: AiErrorDto })
@ApiServiceUnavailableResponse({ type: AiErrorDto })
@Controller('designs')
export class DesignsController {
  constructor(private readonly designsService: DesignsService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'List the authenticated user designs' })
  @ApiOkResponse({ type: [DesignSummaryDto] })
  async list(
    @Query() query: ListDesignsQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<DesignSummaryDto[]> {
    return this.designsService.list(request.user?.id ?? '', query.profileId);
  }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get a design with a fresh signed image URL' })
  @ApiOkResponse({ type: DesignDetailDto })
  @ApiNotFoundResponse({ type: AiErrorDto })
  async get(
    @Param('id') designId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<DesignDetailDto> {
    return this.designsService.get(designId, request.user?.id ?? '');
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a design' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async remove(
    @Param('id') designId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.designsService.remove(designId, request.user?.id ?? '');
  }
}
