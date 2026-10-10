import { AiProviderError } from '../ai.errors';
import { BookOutputParser } from './book-output.parser';

const VALID_JSON =
  '{"title":"Cuento","pages":[{"pageNumber":1,"content":"Había una vez"}]}';

describe('BookOutputParser', () => {
  const parser = new BookOutputParser();

  it('parses clean JSON', () => {
    expect(parser.parse(VALID_JSON)).toEqual({
      title: 'Cuento',
      pages: [{ pageNumber: 1, content: 'Había una vez' }],
    });
  });

  it('parses JSON inside a fenced block', () => {
    const text = `Aquí está tu cuento:\n\`\`\`json\n${VALID_JSON}\n\`\`\`\nEspero que te guste.`;

    expect(parser.parse(text)).toMatchObject({ title: 'Cuento' });
  });

  it('parses JSON embedded in prose', () => {
    const text = `Claro, aquí va: ${VALID_JSON} gracias.`;

    expect(parser.parse(text)).toMatchObject({ title: 'Cuento' });
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
    expect(() => parser.parse('{"title": "Cuento", pages: [}')).toThrow(
      AiProviderError,
    );
  });

  it('rejects empty responses', () => {
    expect(() => parser.parse('   ')).toThrow(AiProviderError);
  });
});
