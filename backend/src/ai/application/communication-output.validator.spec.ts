import { AiProviderError } from '../ai.errors';
import { CommunicationOutputValidator } from './communication-output.validator';

const VALID_PAYLOAD = {
  title: 'Cómo me siento',
  cells: [
    { label: 'Contento', imagePrompt: 'A happy face pictogram' },
    { label: 'Triste', imagePrompt: 'A sad face pictogram' },
    { label: 'Cansado', imagePrompt: 'A tired face pictogram' },
    { label: 'Enojado', imagePrompt: 'An angry face pictogram' },
    { label: 'Tranquilo', imagePrompt: 'A calm face pictogram' },
    { label: 'Con miedo', imagePrompt: 'A scared face pictogram' },
  ],
};

describe('CommunicationOutputValidator', () => {
  const validator = new CommunicationOutputValidator();

  it('accepts a valid 6-cell board for a child audience', () => {
    const result = validator.validate(VALID_PAYLOAD, 'child', 6);

    expect(result.title).toBe('Cómo me siento');
    expect(result.cells).toHaveLength(6);
    expect(result.cells[0]?.label).toBe('Contento');
  });

  it('rejects a board whose cell count does not match the request', () => {
    expect(() => validator.validate(VALID_PAYLOAD, 'child', 4)).toThrow(
      AiProviderError,
    );

    try {
      validator.validate(VALID_PAYLOAD, 'child', 4);
    } catch (error) {
      expect((error as AiProviderError).code).toBe('INVALID_OUTPUT');
    }
  });

  it('rejects labels over 40 chars', () => {
    const payload = {
      ...VALID_PAYLOAD,
      cells: VALID_PAYLOAD.cells.map((cell, index) =>
        index === 0 ? { ...cell, label: 'x'.repeat(41) } : cell,
      ),
    };

    expect(() => validator.validate(payload, 'child', 6)).toThrow(
      AiProviderError,
    );
  });

  it('rejects non-object payloads', () => {
    expect(() => validator.validate(null, 'child', 6)).toThrow(AiProviderError);
    expect(() => validator.validate('texto', 'child', 6)).toThrow(
      AiProviderError,
    );
  });

  it('blocks generated content that violates the child guidelines', () => {
    const payload = {
      ...VALID_PAYLOAD,
      cells: VALID_PAYLOAD.cells.map((cell, index) =>
        index === 0 ? { ...cell, label: 'Sangre y violencia' } : cell,
      ),
    };

    try {
      validator.validate(payload, 'child', 6);
      throw new Error('should have thrown CONTENT_BLOCKED');
    } catch (error) {
      expect((error as AiProviderError).code).toBe('CONTENT_BLOCKED');
    }
  });

  it('rejects inputs that violate the content guidelines', () => {
    expect(() =>
      validator.assertInputAllowed(
        { kind: 'feelings', topic: 'guerra total', style: 'Pictogramas' },
        'child',
      ),
    ).toThrow(AiProviderError);
  });

  it('allows clean inputs', () => {
    expect(() =>
      validator.assertInputAllowed(
        { kind: 'feelings', topic: 'Cómo me siento', style: 'Pictogramas' },
        'child',
      ),
    ).not.toThrow();
  });
});
