import { AiProviderError } from '../ai.errors';
import {
  DESIGN_LIMITS,
  DesignOutputValidator,
} from './design-output.validator';

const buildPayload = (overrides: Record<string, unknown> = {}) => ({
  title: 'Fiesta de cumple',
  message: 'Fiesta el sabado a las 17 en el salon',
  imagePrompt: 'A colorful birthday flyer with balloons',
  ...overrides,
});

function codeOf(run: () => unknown): string | undefined {
  try {
    run();
    return undefined;
  } catch (error) {
    return error instanceof AiProviderError ? error.code : undefined;
  }
}

describe('DesignOutputValidator', () => {
  const validator = new DesignOutputValidator();

  it('accepts a valid flyer', () => {
    const design = validator.validate(buildPayload(), 'child');

    expect(design.title).toBe('Fiesta de cumple');
    expect(design.message).toBe('Fiesta el sabado a las 17 en el salon');
    expect(design.imagePrompt).toBe('A colorful birthday flyer with balloons');
  });

  it('ignores extra fields from the model', () => {
    const design = validator.validate(
      buildPayload({ extra: 'x', pages: [] }),
      'child',
    );

    expect(design.title).toBe('Fiesta de cumple');
  });

  it('rejects invalid payloads with INVALID_OUTPUT', () => {
    const invalidPayloads: unknown[] = [
      null,
      'not-an-object',
      buildPayload({ title: '' }),
      buildPayload({ message: '' }),
      buildPayload({
        message: 'x'.repeat(DESIGN_LIMITS.maxMessageChars + 1),
      }),
      buildPayload({
        title: 'x'.repeat(DESIGN_LIMITS.maxTitleChars + 1),
      }),
      buildPayload({
        imagePrompt: 'x'.repeat(DESIGN_LIMITS.maxImagePromptChars + 1),
      }),
      buildPayload({ imagePrompt: undefined, title: 'Solo titulo' }),
    ];

    for (const payload of invalidPayloads) {
      expect(codeOf(() => validator.validate(payload, 'child'))).toBe(
        'INVALID_OUTPUT',
      );
    }
  });

  it('blocks child content with banned terms but allows adults', () => {
    const payload = buildPayload({
      message: 'Fiesta con mucha sangre en el salon',
    });

    expect(codeOf(() => validator.validate(payload, 'child'))).toBe(
      'CONTENT_BLOCKED',
    );
    expect(validator.validate(payload, 'adult').title).toBe('Fiesta de cumple');
  });

  it('matches blocked terms on whole words only', () => {
    const innocent = buildPayload({ message: 'Retirar en la farmacia' });

    expect(codeOf(() => validator.validate(innocent, 'child'))).toBeUndefined();
    expect(
      codeOf(() =>
        validator.validate(
          buildPayload({ message: 'Traer un arma de juguete' }),
          'child',
        ),
      ),
    ).toBe('CONTENT_BLOCKED');
  });

  it('rejects blocked input terms with INVALID_REQUEST', () => {
    expect(
      codeOf(() =>
        validator.assertInputAllowed(
          {
            occasion: 'birthday',
            message: 'Fiesta con sangre',
            style: 'Acuarela',
          },
          'child',
        ),
      ),
    ).toBe('INVALID_REQUEST');
  });

  it('accepts clean input', () => {
    expect(() =>
      validator.assertInputAllowed(
        {
          occasion: 'birthday',
          message: 'Fiesta el sabado a las 17',
          style: 'Acuarela',
        },
        'child',
      ),
    ).not.toThrow();
  });
});
