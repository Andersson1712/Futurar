import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  CreateProfileInput,
  DEFAULT_PROFILE_SETTINGS,
  Profile,
  ProfileRepository,
  ProfileSettings,
  UpdateProfileInput,
} from './profile.repository';

@Injectable()
export class InMemoryProfileRepository implements ProfileRepository {
  private readonly profiles = new Map<string, Profile>();
  private readonly settings = new Map<string, ProfileSettings>();

  list(teacherId: string, activeOnly: boolean): Promise<Profile[]> {
    const list = [...this.profiles.values()]
      .filter(
        (profile) =>
          profile.teacherId === teacherId && (!activeOnly || profile.isActive),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((profile) => this.withSettings(profile));

    return Promise.resolve(list);
  }

  listActive(): Promise<Profile[]> {
    const list = [...this.profiles.values()]
      .filter((profile) => profile.isActive)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((profile) => this.withSettings(profile));

    return Promise.resolve(list);
  }

  findById(profileId: string, teacherId: string): Promise<Profile | undefined> {
    const profile = this.profiles.get(profileId);

    if (!profile || profile.teacherId !== teacherId) {
      return Promise.resolve(undefined);
    }

    return Promise.resolve(this.withSettings(profile));
  }

  create(teacherId: string, input: CreateProfileInput): Promise<Profile> {
    const now = new Date();
    const profile: Profile = {
      id: randomUUID(),
      teacherId,
      name: input.name,
      age: input.age,
      birthdate: input.birthdate,
      avatarIcon: input.avatarIcon ?? 'person',
      notes: input.notes,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    this.profiles.set(profile.id, profile);

    return Promise.resolve(this.withSettings(profile));
  }

  update(
    profileId: string,
    teacherId: string,
    patch: UpdateProfileInput,
  ): Promise<Profile | undefined> {
    const profile = this.profiles.get(profileId);

    if (!profile || profile.teacherId !== teacherId) {
      return Promise.resolve(undefined);
    }

    Object.assign(profile, stripUndefined(patch), { updatedAt: new Date() });

    return Promise.resolve(this.withSettings(profile));
  }

  deactivate(profileId: string, teacherId: string): Promise<boolean> {
    const profile = this.profiles.get(profileId);

    if (!profile || profile.teacherId !== teacherId || !profile.isActive) {
      return Promise.resolve(false);
    }

    profile.isActive = false;
    profile.updatedAt = new Date();

    return Promise.resolve(true);
  }

  getSettings(profileId: string): Promise<ProfileSettings | undefined> {
    return Promise.resolve(
      this.settings.get(profileId) ?? DEFAULT_PROFILE_SETTINGS,
    );
  }

  saveSettings(
    profileId: string,
    settings: ProfileSettings,
  ): Promise<ProfileSettings> {
    this.settings.set(profileId, settings);

    return Promise.resolve(settings);
  }

  private withSettings(profile: Profile): Profile {
    return {
      ...profile,
      settings: this.settings.get(profile.id) ?? DEFAULT_PROFILE_SETTINGS,
    };
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}
