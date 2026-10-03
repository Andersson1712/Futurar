import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
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
  CreateProfileDto,
  ListProfilesQueryDto,
  SaveProfileSettingsDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import {
  SaveProfileActionsDto,
  SaveProfileItemsDto,
} from '../actions/dto/action.dto';
import type {
  ProfileActionEntry,
  ProfileItemEntry,
} from '../actions/action.repository';
import type {
  Profile,
  ProfileOptions,
  ProfileSettings,
} from './profile.repository';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: AiErrorDto })
@ApiServiceUnavailableResponse({ type: AiErrorDto })
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'List the teacher profiles' })
  async list(
    @Query() query: ListProfilesQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Profile[]> {
    return this.profiles.list(request.user?.id ?? '', query.active ?? true);
  }

  @Get('active')
  @ApiOperation({
    summary: 'List active profiles for the student kiosk entry (no auth)',
  })
  @ApiOkResponse()
  async listActive(): Promise<Profile[]> {
    return this.profiles.listActivePublic();
  }

  @Post()
  @UseGuards(SupabaseAuthGuard)
  @ApiCreatedResponse()
  async create(
    @Body() dto: CreateProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Profile> {
    return this.profiles.create(request.user?.id ?? '', dto);
  }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async get(
    @Param('id') profileId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<Profile> {
    return this.profiles.get(profileId, request.user?.id ?? '');
  }

  @Patch(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async update(
    @Param('id') profileId: string,
    @Body() dto: UpdateProfileDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<Profile> {
    return this.profiles.update(profileId, request.user?.id ?? '', dto);
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async deactivate(
    @Param('id') profileId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.profiles.deactivate(profileId, request.user?.id ?? '');
  }

  @Put(':id/settings')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async saveSettings(
    @Param('id') profileId: string,
    @Body() dto: SaveProfileSettingsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileSettings> {
    return this.profiles.saveSettings(profileId, request.user?.id ?? '', dto);
  }

  @Get(':id/options')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async listOptions(
    @Param('id') profileId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileOptions> {
    return this.profiles.listOptions(profileId, request.user?.id ?? '');
  }

  @Get(':id/actions')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async listActions(
    @Param('id') profileId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileActionEntry[]> {
    return this.profiles.listProfileActions(profileId, request.user?.id ?? '');
  }

  @Put(':id/actions')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async saveActions(
    @Param('id') profileId: string,
    @Body() dto: SaveProfileActionsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileActionEntry[]> {
    return this.profiles.saveProfileActions(
      profileId,
      request.user?.id ?? '',
      dto,
    );
  }

  @Get(':id/items')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async listItems(
    @Param('id') profileId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileItemEntry[]> {
    return this.profiles.listProfileItems(profileId, request.user?.id ?? '');
  }

  @Put(':id/items')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async saveItems(
    @Param('id') profileId: string,
    @Body() dto: SaveProfileItemsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileItemEntry[]> {
    return this.profiles.saveProfileItems(
      profileId,
      request.user?.id ?? '',
      dto,
    );
  }
}
