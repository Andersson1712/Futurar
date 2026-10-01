import { Inject, Injectable } from '@nestjs/common';
import { AiErrorException } from '../common/errors/ai-error.exception';
import { ACTION_REPOSITORY } from '../actions/action.repository';
import type {
  ActionRepository,
  ProfileActionEntry,
  ProfileItemEntry,
} from '../actions/action.repository';
import { ActionsService } from '../actions/actions.service';
import {
  DEFAULT_PROFILE_SETTINGS,
  PROFILE_REPOSITORY,
} from './profile.repository';
import type {
  Profile,
  ProfileOptions,
  ProfileRepository,
  ProfileSettings,
} from './profile.repository';
import {
  CreateProfileDto,
  SaveProfileSettingsDto,
  UpdateProfileDto,
} from './dto/profile.dto';
import type {
  SaveProfileActionsDto,
  SaveProfileItemsDto,
} from '../actions/dto/action.dto';
import type {
  BookDefaults,
  ProfileSettingsProvider,
} from './profile-settings.provider';

@Injectable()
export class ProfilesService implements ProfileSettingsProvider {
  constructor(
    @Inject(PROFILE_REPOSITORY)
    private readonly repository: ProfileRepository,
    @Inject(ACTION_REPOSITORY)
    private readonly actions: ActionRepository,
    private readonly actionsService: ActionsService,
  ) {}

  list(teacherId: string, activeOnly = true): Promise<Profile[]> {
    return this.repository.list(teacherId, activeOnly);
  }

  async get(profileId: string, teacherId: string): Promise<Profile> {
    const profile = await this.repository.findById(profileId, teacherId);

    if (!profile) throw profileNotFound();

    return profile;
  }

  async create(teacherId: string, dto: CreateProfileDto): Promise<Profile> {
    const profile = await this.repository.create(teacherId, dto);

    await this.actions.seedProfileDefaults(profile.id, teacherId);

    return profile;
  }

  async update(
    profileId: string,
    teacherId: string,
    dto: UpdateProfileDto,
  ): Promise<Profile> {
    const updated = await this.repository.update(profileId, teacherId, dto);

    if (!updated) throw profileNotFound();

    return updated;
  }

  async deactivate(profileId: string, teacherId: string): Promise<void> {
    const deactivated = await this.repository.deactivate(profileId, teacherId);

    if (!deactivated) throw profileNotFound();
  }

  async getSettings(
    profileId: string,
    teacherId: string,
  ): Promise<ProfileSettings> {
    await this.get(profileId, teacherId);

    return (
      (await this.repository.getSettings(profileId)) ?? DEFAULT_PROFILE_SETTINGS
    );
  }

  async saveSettings(
    profileId: string,
    teacherId: string,
    dto: SaveProfileSettingsDto,
  ): Promise<ProfileSettings> {
    await this.get(profileId, teacherId);

    const current =
      (await this.repository.getSettings(profileId)) ??
      DEFAULT_PROFILE_SETTINGS;

    const { modules, ...rest } = dto;
    const merged: ProfileSettings = {
      ...current,
      ...stripUndefined(rest),
      modules: { ...current.modules, ...stripUndefined(modules ?? {}) },
    };

    const saved = await this.repository.saveSettings(profileId, merged);

    if (modules) {
      await this.actions.syncProfileActions(profileId, teacherId, {
        create: merged.modules.create,
        library: merged.modules.library,
        design: merged.modules.design,
      });
    }

    return saved;
  }

  async listOptions(
    profileId: string,
    teacherId: string,
  ): Promise<ProfileOptions> {
    await this.get(profileId, teacherId);

    return this.actions.getStudentOptions(profileId);
  }

  async listProfileActions(
    profileId: string,
    teacherId: string,
  ): Promise<ProfileActionEntry[]> {
    await this.get(profileId, teacherId);

    return this.actions.getProfileActions(profileId, teacherId);
  }

  async saveProfileActions(
    profileId: string,
    teacherId: string,
    dto: SaveProfileActionsDto,
  ): Promise<ProfileActionEntry[]> {
    await this.get(profileId, teacherId);

    const saved = await this.actions.saveProfileActions(
      profileId,
      teacherId,
      dto.actions,
    );

    if (!saved) throw actionNotFound();

    return saved;
  }

  async listProfileItems(
    profileId: string,
    teacherId: string,
  ): Promise<ProfileItemEntry[]> {
    await this.get(profileId, teacherId);

    return this.actions.getProfileItems(profileId, teacherId);
  }

  async saveProfileItems(
    profileId: string,
    teacherId: string,
    dto: SaveProfileItemsDto,
  ): Promise<ProfileItemEntry[]> {
    await this.get(profileId, teacherId);

    const saved = await this.actionsService.saveProfileItems(
      profileId,
      teacherId,
      dto.items,
    );

    if (!saved) throw itemNotFound();

    return saved;
  }

  async getBookDefaults(profileId: string): Promise<BookDefaults> {
    const settings = await this.repository.getSettings(profileId);

    if (!settings) return {};

    return {
      storySize: settings.bookStorySize,
      audience: settings.bookAudience,
    };
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as Partial<T>;
}

function profileNotFound(): AiErrorException {
  return new AiErrorException(404, 'NOT_FOUND', 'Profile not found');
}

function actionNotFound(): AiErrorException {
  return new AiErrorException(404, 'NOT_FOUND', 'Action not found');
}

function itemNotFound(): AiErrorException {
  return new AiErrorException(404, 'NOT_FOUND', 'Item not found');
}
