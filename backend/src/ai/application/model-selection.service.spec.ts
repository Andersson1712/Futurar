import { ConfigService } from '@nestjs/config';
import type { PinoLogger } from 'nestjs-pino';
import {
  OPENROUTER_DEFAULTS,
  OPENROUTER_IMAGE_ALTERNATES,
} from '../infrastructure/openrouter/openrouter.config';
import { InMemoryTeacherAiSettingsRepository } from './in-memory-teacher-ai-settings.repository';
import { ModelSelectionService } from './model-selection.service';

const DEFAULT_TEXT = OPENROUTER_DEFAULTS.textModel;
const DEFAULT_IMAGE = OPENROUTER_DEFAULTS.imageModel;
const DESIGN_IMAGE = OPENROUTER_IMAGE_ALTERNATES[1];

function spyLogger(): { logger: PinoLogger; warn: jest.Mock } {
  const warn = jest.fn();
  const logger = {
    setContext: jest.fn(),
    warn,
  } as unknown as PinoLogger;

  return { logger, warn };
}

interface CapturedError {
  code?: string;
  getStatus: () => number;
}

function captureError(fn: () => void): CapturedError | undefined {
  try {
    fn();
    return undefined;
  } catch (error) {
    return error as CapturedError;
  }
}

function build(config: Record<string, unknown> = {}) {
  const repository = new InMemoryTeacherAiSettingsRepository();
  const { logger, warn } = spyLogger();
  const service = new ModelSelectionService(
    repository,
    new ConfigService({
      OPENROUTER_BOOK_TEXT_MODEL: DEFAULT_TEXT,
      OPENROUTER_BOOK_IMAGE_MODEL: DEFAULT_IMAGE,
      ...config,
    }),
    logger,
  );

  return { service, repository, warn };
}

describe('ModelSelectionService (SPEC-033B)', () => {
  it('exposes the curated catalog with hard defaults and reports OpenRouter disabled by default', () => {
    const { service } = build();

    const catalog = service.catalog();

    expect(catalog.text).toEqual([DEFAULT_TEXT]);
    expect(catalog.image).toEqual([
      DEFAULT_IMAGE,
      ...OPENROUTER_IMAGE_ALTERNATES,
    ]);
    expect(catalog.defaults).toEqual({
      text: DEFAULT_TEXT,
      image: DEFAULT_IMAGE,
    });
    expect(catalog.openRouterEnabled).toBe(false);
  });

  it('reports openRouterEnabled true when OPENROUTER_ENABLED is on', () => {
    const { service } = build({ OPENROUTER_ENABLED: 'true' });

    expect(service.catalog().openRouterEnabled).toBe(true);
  });

  it('falls back to the env default per vertical when no preference is stored', async () => {
    const { service } = build({
      OPENROUTER_DESIGN_IMAGE_MODEL: DESIGN_IMAGE,
    });

    await expect(service.resolveText('teacher-1', 'book')).resolves.toBe(
      DEFAULT_TEXT,
    );
    await expect(service.resolveImage('teacher-1', 'design')).resolves.toBe(
      DESIGN_IMAGE,
    );
  });

  it('prefers a valid stored teacher preference over the env default', async () => {
    const { service, repository } = build();
    await repository.upsert('teacher-1', { imageModel: DESIGN_IMAGE });

    await expect(service.resolveImage('teacher-1', 'book')).resolves.toBe(
      DESIGN_IMAGE,
    );
  });

  it('falls back to the env default for a stale stored slug and warns (never throws)', async () => {
    const { service, repository, warn } = build();
    await repository.upsert('teacher-1', { textModel: 'retired/model' });

    await expect(service.resolveText('teacher-1', 'book')).resolves.toBe(
      DEFAULT_TEXT,
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('uses the env default when no owner is supplied (background job)', async () => {
    const { service } = build();

    await expect(service.resolveText(undefined, 'book')).resolves.toBe(
      DEFAULT_TEXT,
    );
  });

  it('rejects unknown slugs at write time with 422 INVALID_MODEL', () => {
    const { service } = build();

    const textError = captureError(() =>
      service.validatePreference({ textModel: 'evil/model' }),
    );
    expect(textError?.code).toBe('INVALID_MODEL');
    expect(textError?.getStatus()).toBe(422);

    const imageError = captureError(() =>
      service.validatePreference({ imageModel: 'evil/model' }),
    );
    expect(imageError?.code).toBe('INVALID_MODEL');

    expect(() =>
      service.validatePreference({ textModel: DEFAULT_TEXT }),
    ).not.toThrow();
  });

  it('returns defaults for unset preferences and persists a valid one', async () => {
    const { service } = build();

    await expect(service.getPreference('teacher-1')).resolves.toEqual({
      textModel: DEFAULT_TEXT,
      imageModel: DEFAULT_IMAGE,
    });

    const saved = await service.savePreference('teacher-1', {
      imageModel: DESIGN_IMAGE,
    });
    expect(saved).toEqual({
      textModel: DEFAULT_TEXT,
      imageModel: DESIGN_IMAGE,
    });
    await expect(service.getPreference('teacher-1')).resolves.toEqual({
      textModel: DEFAULT_TEXT,
      imageModel: DESIGN_IMAGE,
    });
  });

  it('rejects and persists nothing when savePreference gets an unknown slug', async () => {
    const { service, repository } = build();

    await expect(
      service.savePreference('teacher-1', { textModel: 'evil/model' }),
    ).rejects.toMatchObject({ code: 'INVALID_MODEL' });
    await expect(repository.get('teacher-1')).resolves.toBeUndefined();
  });
});
