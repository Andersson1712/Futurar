import { ConfigService } from '@nestjs/config';

/**
 * SPEC-033 — curated OpenRouter allowlist, pinned at implementation from
 * the live catalog (Oct 2026, 033-1):
 * - text default `google/gemini-3.8-flash` (structured outputs verified)
 * - image default `google/gemini-3.1-flash-image` (Nano Banana 2)
 * - documented image alternates `openai/gpt-image-2`, `qwen/qwen-image-3-pro`
 *
 * Per vertical (`book`, `design`), one text model + one image model.
 * Unknown slugs fail boot loudly, same rule as the Gemini config.
 */
export const OPENROUTER_DEFAULTS = {
  textModel: 'google/gemini-3.8-flash',
  imageModel: 'google/gemini-3.1-flash-image',
} as const;

export const OPENROUTER_IMAGE_ALTERNATES = [
  'openai/gpt-image-2',
  'qwen/qwen-image-3-pro',
] as const;

const KNOWN_TEXT_MODELS: readonly string[] = [OPENROUTER_DEFAULTS.textModel];
const KNOWN_IMAGE_MODELS: readonly string[] = [
  OPENROUTER_DEFAULTS.imageModel,
  ...OPENROUTER_IMAGE_ALTERNATES,
];

export interface OpenRouterVerticalModels {
  textModel: string;
  imageModel: string;
}

export interface OpenRouterModelConfig {
  enabled: boolean;
  book: OpenRouterVerticalModels;
  design: OpenRouterVerticalModels;
}

/**
 * Privacy gate (owner review, blocks activation): children's content flows
 * through an aggregator with third-party retention policies. Keep
 * `OPENROUTER_ENABLED=true` to dev until that review is documented.
 */
export function isOpenRouterEnabled(configService: ConfigService): boolean {
  const value = configService.get<unknown>('OPENROUTER_ENABLED');

  return value === true || value === 'true' || value === '1';
}

export function resolveOpenRouterConfig(
  configService: ConfigService,
): OpenRouterModelConfig {
  return {
    enabled: isOpenRouterEnabled(configService),
    book: {
      textModel: resolveTextModel(configService, 'OPENROUTER_BOOK_TEXT_MODEL'),
      imageModel: resolveImageModel(
        configService,
        'OPENROUTER_BOOK_IMAGE_MODEL',
      ),
    },
    design: {
      textModel: resolveTextModel(
        configService,
        'OPENROUTER_DESIGN_TEXT_MODEL',
      ),
      imageModel: resolveImageModel(
        configService,
        'OPENROUTER_DESIGN_IMAGE_MODEL',
      ),
    },
  };
}

function resolveTextModel(configService: ConfigService, key: string): string {
  const slug =
    configService.get<string>(key)?.trim() || OPENROUTER_DEFAULTS.textModel;

  if (!KNOWN_TEXT_MODELS.includes(slug)) {
    throw new Error(
      `Unknown OpenRouter text model "${slug}" in ${key}; ` +
        `allowed: ${KNOWN_TEXT_MODELS.join(', ')}`,
    );
  }

  return slug;
}

function resolveImageModel(configService: ConfigService, key: string): string {
  const slug =
    configService.get<string>(key)?.trim() || OPENROUTER_DEFAULTS.imageModel;

  if (!KNOWN_IMAGE_MODELS.includes(slug)) {
    throw new Error(
      `Unknown OpenRouter image model "${slug}" in ${key}; ` +
        `allowed: ${KNOWN_IMAGE_MODELS.join(', ')}`,
    );
  }

  return slug;
}
