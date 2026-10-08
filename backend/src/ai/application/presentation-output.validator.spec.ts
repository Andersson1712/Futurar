import { AiProviderError } from '../ai.errors';
import { PresentationOutputValidator } from './presentation-output.validator';

const VALID_PAYLOAD = {
  title: 'Dinosaurios',
  slides: [
    {
      title: 'Qué son',
      bullets: ['Vivieron hace millones de años', 'Eran reptiles gigantes'],
      imagePrompt: 'A friendly dinosaur illustration',
    },
    {
      title: 'Qué comían',
      bullets: ['Algunos comían plantas', 'Otros comían carne'],
      imagePrompt: 'Dinosaurs eating plants',
    },
    {
      title: 'Dónde vivían',
      bullets: ['En todos los continentes', 'Cerca del agua'],
      imagePrompt: 'Prehistoric landscape with water',
    },
    {
      title: 'Cómo se extinguieron',
      bullets: ['Un asteroide gigante', 'Cambió el clima'],
      imagePrompt: 'Asteroid over the earth',
    },
    {
      title: 'Qué dejaron',
      bullets: ['Fósiles en museos', 'Huesos gigantes'],
      imagePrompt: 'Dinosaur fossils in a museum',
    },
  ],
};

describe('PresentationOutputValidator', () => {
  const validator = new PresentationOutputValidator();

  it('accepts a valid 5-slide deck for a child audience', () => {
    const result = validator.validate(VALID_PAYLOAD, 'child', 5);

    expect(result.title).toBe('Dinosaurios');
    expect(result.slides).toHaveLength(5);
    expect(result.slides[0]?.bullets).toHaveLength(2);
  });

  it('rejects a deck whose slide count does not match the request', () => {
    expect(() => validator.validate(VALID_PAYLOAD, 'child', 8)).toThrow(
      AiProviderError,
    );

    try {
      validator.validate(VALID_PAYLOAD, 'child', 8);
    } catch (error) {
      expect((error as AiProviderError).code).toBe('INVALID_OUTPUT');
    }
  });

  it('rejects slides with fewer than 2 bullets', () => {
    const payload = {
      ...VALID_PAYLOAD,
      slides: VALID_PAYLOAD.slides.map((slide, index) =>
        index === 0 ? { ...slide, bullets: ['Solo una'] } : slide,
      ),
    };

    expect(() => validator.validate(payload, 'child', 5)).toThrow(
      AiProviderError,
    );
  });

  it('rejects non-object payloads', () => {
    expect(() => validator.validate(null, 'child', 5)).toThrow(AiProviderError);
    expect(() => validator.validate('texto', 'child', 5)).toThrow(
      AiProviderError,
    );
  });

  it('blocks generated content that violates the child guidelines', () => {
    const payload = {
      ...VALID_PAYLOAD,
      slides: VALID_PAYLOAD.slides.map((slide, index) =>
        index === 0
          ? {
              ...slide,
              bullets: ['Vivieron con violencia extrema', 'Eran reptiles'],
            }
          : slide,
      ),
    };

    try {
      validator.validate(payload, 'child', 5);
      throw new Error('should have thrown CONTENT_BLOCKED');
    } catch (error) {
      expect((error as AiProviderError).code).toBe('CONTENT_BLOCKED');
    }
  });

  it('rejects inputs that violate the content guidelines', () => {
    expect(() =>
      validator.assertInputAllowed(
        { topic: 'guerra total', style: 'Acuarela' },
        'child',
      ),
    ).toThrow(AiProviderError);
  });

  it('allows clean inputs', () => {
    expect(() =>
      validator.assertInputAllowed(
        { topic: 'Los dinosaurios', style: 'Acuarela' },
        'child',
      ),
    ).not.toThrow();
  });
});
