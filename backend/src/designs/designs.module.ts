import { Module } from '@nestjs/common';
import { BooksModule } from '../books/books.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseService } from '../supabase/supabase.service';
import { DESIGN_REPOSITORY } from './design.repository';
import type { DesignRepository } from './design.repository';
import { DesignsController } from './designs.controller';
import { DesignsService } from './designs.service';
import { InMemoryDesignRepository } from './in-memory-design.repository';
import { SupabaseDesignRepository } from './supabase-design.repository';

@Module({
  imports: [SupabaseModule, BooksModule],
  controllers: [DesignsController],
  providers: [
    InMemoryDesignRepository,
    {
      provide: DESIGN_REPOSITORY,
      useFactory: (
        supabaseService: SupabaseService,
        memory: InMemoryDesignRepository,
      ): DesignRepository =>
        supabaseService.getClient()
          ? new SupabaseDesignRepository(supabaseService)
          : memory,
      inject: [SupabaseService, InMemoryDesignRepository],
    },
    DesignsService,
  ],
  exports: [DESIGN_REPOSITORY],
})
export class DesignsModule {}
