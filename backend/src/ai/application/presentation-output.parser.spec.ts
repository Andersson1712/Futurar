import { AiProviderError } from '../ai.errors';
import { PresentationOutputParser } from './presentation-output.parser';

const VALID_JSON =
  '{"title":"Dinosaurios","slides":[{"title":"Qué son","bullets":["Vivieron hace millones de años","Eran reptiles gigantes"],"imagePrompt":"A friendly dinosaur illustration"},{"title":"Qué comían","bullets":["Algunos comían plantas","Otros comían carne"],"imagePrompt":"Dinosaurs eating plants"}]}';

describe('PresentationOutputParser', () => {
  const parser = new PresentationOutputParser();

  it('parses clean JSON', () => {
    const parsed = parser.parse(VALID_JSON) as {
      title: string;
      slides: unknown[];
    };

    expect(parsed.title).toBe('Dinosaurios');
    expect(parsed.slides).toHaveLength(2);
  });

  it('parses JSON inside a fenced block', () => {
    const text = `Aquí está tu presentación:\n\`\`\`json\n${VALID_JSON}\n\`\`\`\nEspero que te guste.`;

    expect(parser.parse(text)).toMatchObject({ title: 'Dinosaurios' });
  });

  it('parses JSON embedded in prose', () => {
    const text = `Claro, aquí va: ${VALID_JSON} gracias.`;

    expect(parser.parse(text)).toMatchObject({ title: 'Dinosaurios' });
  });

  it('rejects responses without JSON', () => {
    expect(() => parser.parse('No tengo JSON para vos')).toThrow(
      AiProviderError,
    );

    try {
      parser.parse('No tengo JSON para vos');
    } catch (error) {
      expect((error as AiProviderError).code).toBe('INVALID_OUTPUT');
    }
  });

  it('rejects malformed JSON', () => {
    expect(() => parser.parse('{"title": "Dinosaurios", slides: }')).toThrow(
      AiProviderError,
    );
  });

  it('rejects empty responses', () => {
    expect(() => parser.parse('   ')).toThrow(AiProviderError);
  });
});
