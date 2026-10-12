import { Module } from '@nestjs/common';
import { BooksModule } from '../books/books.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseService } from '../supabase/supabase.service';
import { COMMUNICATION_REPOSITORY } from './communication.repository';
import type { CommunicationRepository } from './communication.repository';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { InMemoryCommunicationRepository } from './in-memory-communication.repository';
import { SupabaseCommunicationRepository } from './supabase-communication.repository';

@Module({
  imports: [SupabaseModule, BooksModule],
  controllers: [CommunicationsController],
  providers: [
    InMemoryCommunicationRepository,
    {
      provide: COMMUNICATION_REPOSITORY,
      useFactory: (
        supabaseService: SupabaseService,
        memory: InMemoryCommunicationRepository,
      ): CommunicationRepository =>
        supabaseService.getClient()
          ? new SupabaseCommunicationRepository(supabaseService)
          : memory,
      inject: [SupabaseService, InMemoryCommunicationRepository],
    },
    CommunicationsService,
  ],
  exports: [COMMUNICATION_REPOSITORY],
})
export class CommunicationsModule {}
