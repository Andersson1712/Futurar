import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AiErrorDto } from '../common/dto/ai-error.dto';
import {
  SupabaseAuthGuard,
  type AuthenticatedRequest,
} from '../common/guards/supabase-auth.guard';
import { AiCredentialsService } from './ai-credentials.service';
import { CREDENTIAL_PROVIDERS } from './secrets/credential.repository';
import { CredentialMetadataDto, SaveCredentialDto } from './dto/credential.dto';

@ApiTags('ai')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: AiErrorDto })
@ApiServiceUnavailableResponse({ type: AiErrorDto })
@Controller('ai/credentials')
export class AiCredentialsController {
  constructor(private readonly credentials: AiCredentialsService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'List credential metadata (never the key)' })
  @ApiOkResponse({ type: [CredentialMetadataDto] })
  async list(
    @Req() request: AuthenticatedRequest,
  ): Promise<CredentialMetadataDto[]> {
    return this.credentials.list(request.user?.id ?? '');
  }

  @Put(':provider')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Create or rotate a provider credential' })
  @ApiParam({ name: 'provider', enum: [...CREDENTIAL_PROVIDERS] })
  @ApiBody({ type: SaveCredentialDto })
  @ApiOkResponse({ type: CredentialMetadataDto })
  @ApiBadRequestResponse({ type: AiErrorDto })
  async save(
    @Param('provider') provider: string,
    @Body() dto: SaveCredentialDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<CredentialMetadataDto> {
    return this.credentials.save(request.user?.id ?? '', provider, dto.apiKey);
  }

  @Delete(':provider')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the active provider credential' })
  @ApiParam({ name: 'provider', enum: [...CREDENTIAL_PROVIDERS] })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async revoke(
    @Param('provider') provider: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.credentials.revoke(request.user?.id ?? '', provider);
  }
}
