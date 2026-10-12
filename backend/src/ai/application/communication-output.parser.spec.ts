import { AiProviderError } from '../ai.errors';
import { CommunicationOutputParser } from './communication-output.parser';

const VALID_JSON =
  '{"title":"Cómo me siento","cells":[{"label":"Contento","imagePrompt":"A happy face pictogram"},{"label":"Triste","imagePrompt":"A sad face pictogram"},{"label":"Cansado","imagePrompt":"A tired face pictogram"},{"label":"Enojado","imagePrompt":"An angry face pictogram"}]}';

describe('CommunicationOutputParser', () => {
  const parser = new CommunicationOutputParser();

  it('parses clean JSON', () => {
    const parsed = parser.parse(VALID_JSON) as {
      title: string;
      cells: unknown[];
    };

    expect(parsed.title).toBe('Cómo me siento');
    expect(parsed.cells).toHaveLength(4);
  });

  it('parses JSON inside a fenced block', () => {
    const text = `Aquí está tu tablero:\n\`\`\`json\n${VALID_JSON}\n\`\`\`\nEspero que te sirva.`;

    expect(parser.parse(text)).toMatchObject({ title: 'Cómo me siento' });
  });

  it('parses JSON embedded in prose', () => {
    const text = `Claro, aquí va: ${VALID_JSON} gracias.`;

    expect(parser.parse(text)).toMatchObject({ title: 'Cómo me siento' });
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
    expect(() => parser.parse('{"title": "Tablero", cells: }')).toThrow(
      AiProviderError,
    );
  });

  it('rejects empty responses', () => {
    expect(() => parser.parse('   ')).toThrow(AiProviderError);
  });
});
