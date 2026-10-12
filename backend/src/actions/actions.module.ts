import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseService } from '../supabase/supabase.service';
import { ACTION_REPOSITORY } from './action.repository';
import type { ActionRepository } from './action.repository';
import { ActionsController } from './actions.controller';
import { ActionsService } from './actions.service';
import { InMemoryActionRepository } from './in-memory-action.repository';
import { SupabaseActionRepository } from './supabase-action.repository';

@Module({
  imports: [SupabaseModule],
  controllers: [ActionsController],
  providers: [
    InMemoryActionRepository,
    {
      provide: ACTION_REPOSITORY,
      useFactory: (
        supabaseService: SupabaseService,
        memory: InMemoryActionRepository,
      ): ActionRepository =>
        supabaseService.getClient()
          ? new SupabaseActionRepository(supabaseService)
          : memory,
      inject: [SupabaseService, InMemoryActionRepository],
    },
    ActionsService,
  ],
  exports: [ACTION_REPOSITORY, ActionsService],
})
export class ActionsModule {}
