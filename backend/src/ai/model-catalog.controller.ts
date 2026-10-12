import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AiErrorDto } from '../common/dto/ai-error.dto';
import {
  SupabaseAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/supabase-auth.guard';
import { ModelSelectionService } from './application/model-selection.service';
import type {
  ModelCatalog,
  ModelPreference,
} from './application/model-selection.service';
import {
  ModelCatalogDto,
  ModelPreferenceDto,
  ModelPreferenceResponseDto,
} from './dto/model-preference.dto';

/**
 * SPEC-033B — teacher-facing curated model catalog and preference.
 * Same teacher auth as `AiCredentialsController` (Supabase bearer token).
 */
@ApiTags('ai')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: AiErrorDto })
@Controller('ai')
export class ModelCatalogController {
  constructor(private readonly models: ModelSelectionService) {}

  @Get('models')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'List the curated AI model catalog' })
  @ApiOkResponse({ type: ModelCatalogDto })
  catalog(): ModelCatalog {
    return this.models.catalog();
  }

  @Get('model-preferences')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Read the teacher AI model preference' })
  @ApiOkResponse({ type: ModelPreferenceResponseDto })
  getPreference(
    @Req() request: AuthenticatedRequest,
  ): Promise<ModelPreference> {
    return this.models.getPreference(request.user?.id ?? '');
  }

  @Put('model-preferences')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Save the teacher AI model preference' })
  @ApiBody({ type: ModelPreferenceDto })
  @ApiOkResponse({ type: ModelPreferenceResponseDto })
  @ApiUnprocessableEntityResponse({ type: AiErrorDto })
  savePreference(
    @Body() dto: ModelPreferenceDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ModelPreference> {
    return this.models.savePreference(request.user?.id ?? '', dto);
  }
}
