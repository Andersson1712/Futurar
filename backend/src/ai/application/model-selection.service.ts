import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { AiErrorException } from '../../common/errors/ai-error.exception';
import type { GenerationVertical } from '../domain/generation-vertical';
import {
  OPENROUTER_DEFAULTS,
  OPENROUTER_KNOWN_IMAGE_MODELS,
  OPENROUTER_KNOWN_TEXT_MODELS,
  isKnownImageModel,
  isKnownTextModel,
  isOpenRouterEnabled,
  resolveOpenRouterConfig,
} from '../infrastructure/openrouter/openrouter.config';
import {
  TEACHER_AI_SETTINGS_REPOSITORY,
  type TeacherAiSettingsPreferences,
  type TeacherAiSettingsRepository,
} from './teacher-ai-settings.repository';

export interface ModelCatalog {
  text: string[];
  image: string[];
  defaults: { text: string; image: string };
  /**
   * SPEC-033B (D6) — backend-owned OpenRouter enablement flag. The frontend
   * renders the picker as disabled when this is false; it is never derived
   * from a browser env var.
   */
  openRouterEnabled: boolean;
}

export interface ModelPreference {
  textModel?: string;
  imageModel?: string;
}

type ModelField = 'textModel' | 'imageModel';

/**
 * SPEC-033B — resolves the effective model slug for a generation.
 *
 * Precedence: teacher preference (repository) → env default per vertical
 * (`resolveOpenRouterConfig`) → hard default (`OPENROUTER_DEFAULTS`).
 * Every resolved slug is validated against the curated allowlist; a stale
 * stored slug (retired from the catalog) falls back to the env default
 * with a warning instead of failing the generation. Invalid values at
 * write time are rejected by `validatePreference` (422 `INVALID_MODEL`).
 */
@Injectable()
export class ModelSelectionService {
  constructor(
    @Inject(TEACHER_AI_SETTINGS_REPOSITORY)
    private readonly repository: TeacherAiSettingsRepository,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ModelSelectionService.name);
  }

  resolveText(
    ownerId: string | undefined,
    vertical: GenerationVertical,
  ): Promise<string> {
    return this.resolve(ownerId, vertical, 'textModel');
  }

  resolveImage(
    ownerId: string | undefined,
    vertical: GenerationVertical,
  ): Promise<string> {
    return this.resolve(ownerId, vertical, 'imageModel');
  }

  catalog(): ModelCatalog {
    return {
      text: [...OPENROUTER_KNOWN_TEXT_MODELS],
      image: [...OPENROUTER_KNOWN_IMAGE_MODELS],
      defaults: {
        text: OPENROUTER_DEFAULTS.textModel,
        image: OPENROUTER_DEFAULTS.imageModel,
      },
      openRouterEnabled: isOpenRouterEnabled(this.configService),
    };
  }

  async getPreference(ownerId: string): Promise<ModelPreference> {
    const stored = await this.repository.get(ownerId);

    return {
      textModel: stored?.textModel ?? OPENROUTER_DEFAULTS.textModel,
      imageModel: stored?.imageModel ?? OPENROUTER_DEFAULTS.imageModel,
    };
  }

  async savePreference(
    ownerId: string,
    preference: TeacherAiSettingsPreferences,
  ): Promise<ModelPreference> {
    this.validatePreference(preference);
    await this.repository.upsert(ownerId, preference);

    return this.getPreference(ownerId);
  }

  validatePreference(preference: TeacherAiSettingsPreferences): void {
    if (
      preference.textModel !== undefined &&
      !isKnownTextModel(preference.textModel)
    ) {
      throw invalidModel('text', preference.textModel);
    }

    if (
      preference.imageModel !== undefined &&
      !isKnownImageModel(preference.imageModel)
    ) {
      throw invalidModel('image', preference.imageModel);
    }
  }

  private async resolve(
    ownerId: string | undefined,
    vertical: GenerationVertical,
    field: ModelField,
  ): Promise<string> {
    const envDefault =
      resolveOpenRouterConfig(this.configService)[vertical][field] ??
      OPENROUTER_DEFAULTS[field];
    const stored = ownerId ? await this.repository.get(ownerId) : undefined;
    const preferred = stored?.[field];

    if (preferred === undefined) return envDefault;

    const known =
      field === 'textModel'
        ? isKnownTextModel(preferred)
        : isKnownImageModel(preferred);

    if (known) return preferred;

    this.logger.warn(
      { ownerId, vertical, model: preferred },
      'Stored AI model is no longer in the curated allowlist; using env default',
    );

    return envDefault;
  }
}

function invalidModel(kind: 'text' | 'image', slug: string): AiErrorException {
  return new AiErrorException(
    422,
    'INVALID_MODEL',
    `Unknown ${kind} model "${slug}"`,
  );
}
