import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
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
import { BooksService } from './books.service';
import {
  BookDetailDto,
  BookSummaryDto,
  SaveDedicationDto,
  SaveFavoriteDto,
} from './dto/book.dto';
import { ListBooksQueryDto } from './dto/list-books.query.dto';

@ApiTags('books')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: AiErrorDto })
@ApiServiceUnavailableResponse({ type: AiErrorDto })
@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'List the authenticated user books' })
  @ApiOkResponse({ type: [BookSummaryDto] })
  async list(
    @Query() query: ListBooksQueryDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<BookSummaryDto[]> {
    return this.booksService.list(request.user?.id ?? '', query.profileId);
  }

  @Get(':id')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Get a book with fresh signed image URLs' })
  @ApiOkResponse({ type: BookDetailDto })
  @ApiNotFoundResponse({ type: AiErrorDto })
  async get(
    @Param('id') bookId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<BookDetailDto> {
    return this.booksService.get(bookId, request.user?.id ?? '');
  }

  @Put(':id/dedication')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Set the dedication of a book' })
  @ApiOkResponse({ type: BookDetailDto })
  @ApiNotFoundResponse({ type: AiErrorDto })
  async saveDedication(
    @Param('id') bookId: string,
    @Body() dto: SaveDedicationDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<BookDetailDto> {
    return this.booksService.saveDedication(
      bookId,
      request.user?.id ?? '',
      dto,
    );
  }

  @Delete(':id/dedication')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Clear the dedication of a book' })
  @ApiOkResponse({ type: BookDetailDto })
  @ApiNotFoundResponse({ type: AiErrorDto })
  async clearDedication(
    @Param('id') bookId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<BookDetailDto> {
    return this.booksService.clearDedication(bookId, request.user?.id ?? '');
  }

  @Put(':id/favorite')
  @UseGuards(SupabaseAuthGuard)
  @ApiOperation({ summary: 'Favorite or unfavorite a book' })
  @ApiOkResponse({ type: BookSummaryDto })
  @ApiNotFoundResponse({ type: AiErrorDto })
  async setFavorite(
    @Param('id') bookId: string,
    @Body() dto: SaveFavoriteDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<BookSummaryDto> {
    return this.booksService.setFavorite(
      bookId,
      request.user?.id ?? '',
      dto.isFavorite,
    );
  }

  @Delete(':id')
  @UseGuards(SupabaseAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a book' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: AiErrorDto })
  async remove(
    @Param('id') bookId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<void> {
    await this.booksService.remove(bookId, request.user?.id ?? '');
  }
}
