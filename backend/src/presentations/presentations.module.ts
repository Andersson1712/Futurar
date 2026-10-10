import { Module } from '@nestjs/common';
import { BooksModule } from '../books/books.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseService } from '../supabase/supabase.service';
import { PRESENTATION_REPOSITORY } from './presentation.repository';
import type { PresentationRepository } from './presentation.repository';
import { InMemoryPresentationRepository } from './in-memory-presentation.repository';
import { PresentationsController } from './presentations.controller';
import { PresentationsService } from './presentations.service';
import { SupabasePresentationRepository } from './supabase-presentation.repository';

@Module({
  imports: [SupabaseModule, BooksModule],
  controllers: [PresentationsController],
  providers: [
    InMemoryPresentationRepository,
    {
      provide: PRESENTATION_REPOSITORY,
      useFactory: (
        supabaseService: SupabaseService,
        memory: InMemoryPresentationRepository,
      ): PresentationRepository =>
        supabaseService.getClient()
          ? new SupabasePresentationRepository(supabaseService)
          : memory,
      inject: [SupabaseService, InMemoryPresentationRepository],
    },
    PresentationsService,
  ],
  exports: [PRESENTATION_REPOSITORY],
})
export class PresentationsModule {}
