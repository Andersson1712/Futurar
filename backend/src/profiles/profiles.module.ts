import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SupabaseService } from '../supabase/supabase.service';
import { CONTACT_REPOSITORY } from './contacts.repository';
import type { ContactRepository } from './contacts.repository';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { InMemoryContactRepository } from './in-memory-contacts.repository';
import { InMemoryProfileRepository } from './in-memory-profile.repository';
import { PROFILE_REPOSITORY } from './profile.repository';
import type { ProfileRepository } from './profile.repository';
import { PROFILE_SETTINGS_PROVIDER } from './profile-settings.provider';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { SupabaseContactRepository } from './supabase-contacts.repository';
import { SupabaseProfileRepository } from './supabase-profile.repository';

@Module({
  imports: [SupabaseModule],
  controllers: [ProfilesController, ContactsController],
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
    InMemoryContactRepository,
    {
      provide: CONTACT_REPOSITORY,
      useFactory: (
        supabaseService: SupabaseService,
        memory: InMemoryContactRepository,
      ): ContactRepository =>
        supabaseService.getClient()
          ? new SupabaseContactRepository(supabaseService)
          : memory,
      inject: [SupabaseService, InMemoryContactRepository],
    },
    ProfilesService,
    ContactsService,
    {
      provide: PROFILE_SETTINGS_PROVIDER,
      useExisting: ProfilesService,
    },
  ],
  exports: [ProfilesService, PROFILE_SETTINGS_PROVIDER],
})
export class ProfilesModule {}
