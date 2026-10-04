import { ConfigService } from '@nestjs/config';
import {
  OPENROUTER_DEFAULTS,
  isOpenRouterEnabled,
  resolveOpenRouterConfig,
} from './openrouter.config';

describe('openrouter.config (SPEC-033)', () => {
  it('resolves the pinned live-catalog defaults per vertical', () => {
    const config = resolveOpenRouterConfig(new ConfigService({}));

    expect(config.enabled).toBe(false);
    expect(config.book.textModel).toBe(OPENROUTER_DEFAULTS.textModel);
    expect(config.book.imageModel).toBe(OPENROUTER_DEFAULTS.imageModel);
    expect(config.design.textModel).toBe(OPENROUTER_DEFAULTS.textModel);
    expect(config.design.imageModel).toBe(OPENROUTER_DEFAULTS.imageModel);
    expect(OPENROUTER_DEFAULTS.textModel).toBe('google/gemini-3.8-flash');
    expect(OPENROUTER_DEFAULTS.imageModel).toBe(
      'google/gemini-3.1-flash-image',
    );
  });

  it('accepts the documented image alternates', () => {
    const config = resolveOpenRouterConfig(
      new ConfigService({
        OPENROUTER_BOOK_IMAGE_MODEL: 'openai/gpt-image-2',
        OPENROUTER_DESIGN_IMAGE_MODEL: 'qwen/qwen-image-3-pro',
      }),
    );

    expect(config.book.imageModel).toBe('openai/gpt-image-2');
    expect(config.design.imageModel).toBe('qwen/qwen-image-3-pro');
  });

  it('fails loudly on an unknown text slug', () => {
    expect(() =>
      resolveOpenRouterConfig(
        new ConfigService({ OPENROUTER_BOOK_TEXT_MODEL: 'nope/not-a-model' }),
      ),
    ).toThrow(/unknown OpenRouter text model/i);
  });

  it('fails loudly on an unknown image slug', () => {
    expect(() =>
      resolveOpenRouterConfig(
        new ConfigService({
          OPENROUTER_DESIGN_IMAGE_MODEL: 'nope/not-a-model',
        }),
      ),
    ).toThrow(/unknown OpenRouter image model/i);
  });

  it('reads the enabled flag tolerantly (never truthy strings)', () => {
    expect(isOpenRouterEnabled(new ConfigService({}))).toBe(false);
    expect(
      isOpenRouterEnabled(new ConfigService({ OPENROUTER_ENABLED: true })),
    ).toBe(true);
    expect(
      isOpenRouterEnabled(new ConfigService({ OPENROUTER_ENABLED: 'true' })),
    ).toBe(true);
    expect(
      isOpenRouterEnabled(new ConfigService({ OPENROUTER_ENABLED: '1' })),
    ).toBe(true);
    expect(
      isOpenRouterEnabled(new ConfigService({ OPENROUTER_ENABLED: 'yes' })),
    ).toBe(false);
  });
});
