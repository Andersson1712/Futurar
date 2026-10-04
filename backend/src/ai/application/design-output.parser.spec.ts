import { AiProviderError } from '../ai.errors';
import { DesignOutputParser } from './design-output.parser';

const VALID_JSON =
  '{"title":"Fiesta","message":"Fiesta el sabado","imagePrompt":"A birthday flyer"}';

describe('DesignOutputParser', () => {
  const parser = new DesignOutputParser();

  it('parses clean JSON', () => {
    expect(parser.parse(VALID_JSON)).toEqual({
      title: 'Fiesta',
      message: 'Fiesta el sabado',
      imagePrompt: 'A birthday flyer',
    });
  });

  it('parses JSON inside a fenced block', () => {
    const text = `Aquí está tu diseño:\n\`\`\`json\n${VALID_JSON}\n\`\`\`\nEspero que te guste.`;

    expect(parser.parse(text)).toMatchObject({ title: 'Fiesta' });
  });

  it('parses JSON embedded in prose', () => {
    const text = `Claro, aquí va: ${VALID_JSON} gracias.`;

    expect(parser.parse(text)).toMatchObject({ title: 'Fiesta' });
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
    expect(() => parser.parse('{"title": "Fiesta", message: }')).toThrow(
      AiProviderError,
    );
  });

  it('rejects empty responses', () => {
    expect(() => parser.parse('   ')).toThrow(AiProviderError);
  });
});
