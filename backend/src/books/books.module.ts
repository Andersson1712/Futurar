import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseService } from '../supabase/supabase.service';
import { BOOK_STORAGE } from './book-storage.port';
import type { BookStorage } from './book-storage.port';
import { BOOK_REPOSITORY } from './book.repository';
import type { BookRepository } from './book.repository';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';
import { DisabledBookStorage } from './disabled-book.storage';
import { InMemoryBookRepository } from './in-memory-book.repository';
import { SupabaseBookStorage } from './supabase-book.storage';
import { SupabaseBookRepository } from './supabase-book.repository';

export const DEFAULT_BOOK_IMAGE_BUCKET = 'book-images';

@Module({
  imports: [SupabaseModule],
  controllers: [BooksController],
  providers: [
    InMemoryBookRepository,
    {
      provide: BOOK_REPOSITORY,
      useFactory: (
        supabaseService: SupabaseService,
        memory: InMemoryBookRepository,
      ): BookRepository =>
        supabaseService.getClient()
          ? new SupabaseBookRepository(supabaseService)
          : memory,
      inject: [SupabaseService, InMemoryBookRepository],
    },
    {
      provide: BOOK_STORAGE,
      useFactory: (
        configService: ConfigService,
        supabaseService: SupabaseService,
      ): BookStorage => {
        if (!supabaseService.getClient()) {
          return new DisabledBookStorage();
        }

        const bucket =
          configService.get<string>('BOOK_IMAGE_BUCKET') ??
          DEFAULT_BOOK_IMAGE_BUCKET;

        return new SupabaseBookStorage(supabaseService, bucket);
      },
      inject: [ConfigService, SupabaseService],
    },
    BooksService,
  ],
  exports: [BOOK_REPOSITORY, BOOK_STORAGE],
})
export class BooksModule {}
