import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseService } from '../supabase/supabase.service';
import { InMemoryProfileRepository } from './in-memory-profile.repository';
import { PROFILE_REPOSITORY } from './profile.repository';
import type { ProfileRepository } from './profile.repository';
import { PROFILE_SETTINGS_PROVIDER } from './profile-settings.provider';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { SupabaseProfileRepository } from './supabase-profile.repository';

@Module({
  imports: [SupabaseModule],
  controllers: [ProfilesController],
  providers: [
    InMemoryProfileRepository,
    {
      provide: PROFILE_REPOSITORY,
      useFactory: (
        supabaseService: SupabaseService,
        memory: InMemoryProfileRepository,
      ): ProfileRepository =>
        supabaseService.getClient()
          ? new SupabaseProfileRepository(supabaseService)
          : memory,
      inject: [SupabaseService, InMemoryProfileRepository],
    },
    ProfilesService,
    {
      provide: PROFILE_SETTINGS_PROVIDER,
      useExisting: ProfilesService,
    },
  ],
  exports: [ProfilesService, PROFILE_SETTINGS_PROVIDER],
})
export class ProfilesModule {}
