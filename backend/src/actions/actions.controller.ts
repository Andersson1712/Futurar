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
import { ActionsService } from './actions.service';
import {
  CreateActionDto,
  CreateItemDto,
  CreateOptionDto,
  UpdateActionDto,
  UpdateItemDto,
  UpdateOptionDto,
} from './dto/action.dto';

@ApiTags('actions')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: AiErrorDto })
@ApiServiceUnavailableResponse({ type: AiErrorDto })
@Controller()
export class ActionsController {
  constructor(private readonly actionsService: ActionsService) {}

  @Get('actions')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'List the teacher action catalog' })
  @ApiOkResponse()
  async list(@Req() request: AuthenticatedRequest) {
    return this.actionsService.list(request.user?.id ?? '');
  }

  @Post('actions')
  @UseGuards(SupabaseAuthGuard)
  @ApiCreatedResponse()
  async create(
    @Body() dto: CreateActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.actionsService.create(request.user?.id ?? '', dto);
  }

  @Get('actions/:id/options')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async listOptions(
    @Param('id') actionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.actionsService.listOptions(actionId, request.user?.id ?? '');
  }

  @Post('actions/:id/options')
  @UseGuards(SupabaseAuthGuard)
  @ApiCreatedResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async createOption(
    @Param('id') actionId: string,
    @Body() dto: CreateOptionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.actionsService.createOption(
      actionId,
      request.user?.id ?? '',
      dto,
    );
  }

  @Patch('actions/:id')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async update(
    @Param('id') actionId: string,
    @Body() dto: UpdateActionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.actionsService.update(actionId, request.user?.id ?? '', dto);
  }

  @Delete('actions/:id')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async deactivate(
    @Param('id') actionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.actionsService.deactivate(actionId, request.user?.id ?? '');
  }

  @Patch('options/:id')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async updateOption(
    @Param('id') optionId: string,
    @Body() dto: UpdateOptionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.actionsService.updateOption(
      optionId,
      request.user?.id ?? '',
      dto,
    );
  }

  @Delete('options/:id')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async deactivateOption(
    @Param('id') optionId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.actionsService.deactivateOption(
      optionId,
      request.user?.id ?? '',
    );
  }

  @Post('options/:id/items')
  @UseGuards(SupabaseAuthGuard)
  @ApiCreatedResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async createItem(
    @Param('id') optionId: string,
    @Body() dto: CreateItemDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.actionsService.createItem(
      optionId,
      request.user?.id ?? '',
      dto,
    );
  }

  @Patch('items/:id')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async updateItem(
    @Param('id') itemId: string,
    @Body() dto: UpdateItemDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.actionsService.updateItem(itemId, request.user?.id ?? '', dto);
  }

  @Delete('items/:id')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async deactivateItem(
    @Param('id') itemId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.actionsService.deactivateItem(itemId, request.user?.id ?? '');
  }
}
