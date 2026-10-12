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
import { ContactsService } from './contacts.service';
import type { ProfileContact } from './contacts.repository';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@ApiTags('contacts')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: AiErrorDto })
@ApiServiceUnavailableResponse({ type: AiErrorDto })
@Controller()
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get('profiles/:profileId/contacts')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'List the contacts of a profile' })
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async list(
    @Param('profileId') profileId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileContact[]> {
    return this.contactsService.list(profileId, request.user?.id ?? '');
  }

  @Post('profiles/:profileId/contacts')
  @UseGuards(SupabaseAuthGuard)
  @ApiCreatedResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async create(
    @Param('profileId') profileId: string,
    @Body() dto: CreateContactDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileContact> {
    return this.contactsService.create(profileId, request.user?.id ?? '', dto);
  }

  @Patch('contacts/:contactId')
  @UseGuards(SupabaseAuthGuard)
  @ApiOkResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async update(
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ProfileContact> {
    return this.contactsService.update(contactId, request.user?.id ?? '', dto);
  }

  @Delete('contacts/:contactId')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async remove(
    @Param('contactId') contactId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.contactsService.remove(contactId, request.user?.id ?? '');
  }
}
