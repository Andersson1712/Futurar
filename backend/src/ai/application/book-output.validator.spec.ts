import { AiProviderError } from '../ai.errors';
import { BOOK_LIMITS, BookOutputValidator } from './book-output.validator';

const buildPayload = (overrides: Record<string, unknown> = {}) => ({
  title: 'La aventura del dragón',
  pages: [
    {
      pageNumber: 1,
      content: 'Había una vez un dragón curioso.',
      imagePrompt: 'A curious dragon in a magic forest',
    },
    {
      pageNumber: 2,
      content: 'El dragón encontró la estrella perdida.',
    },
  ],
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

describe('BookOutputValidator', () => {
  const validator = new BookOutputValidator();

  it('accepts a valid book and computes totalPages', () => {
    const book = validator.validate(buildPayload(), 'child');

    expect(book.title).toBe('La aventura del dragón');
    expect(book.totalPages).toBe(2);
    expect(book.pages[0]).toEqual({
      pageNumber: 1,
      content: 'Había una vez un dragón curioso.',
      imagePrompt: 'A curious dragon in a magic forest',
    });
  });

  it('keeps an optional dedication', () => {
    const book = validator.validate(
      buildPayload({ dedication: 'Para mi abuela' }),
      'child',
    );

    expect(book.dedication).toBe('Para mi abuela');
  });

  it('ignores extra fields such as totalPages from the model', () => {
    const book = validator.validate(
      buildPayload({ totalPages: 99, extra: 'x' }),
      'child',
    );

    expect(book.totalPages).toBe(2);
  });

  it('rejects invalid payloads with INVALID_OUTPUT', () => {
    const invalidPayloads: unknown[] = [
      null,
      'not-an-object',
      buildPayload({ title: '' }),
      buildPayload({ pages: [] }),
      buildPayload({
        pages: [{ pageNumber: 2, content: 'Fuera de orden' }],
      }),
      buildPayload({
        pages: [
          { pageNumber: 1, content: 'x'.repeat(BOOK_LIMITS.maxPageChars + 1) },
        ],
      }),
      buildPayload({
        pages: Array.from({ length: BOOK_LIMITS.maxPages + 1 }, (_, index) => ({
          pageNumber: index + 1,
          content: 'ok',
        })),
      }),
      buildPayload({
        pages: [
          { pageNumber: 1, content: 'a'.repeat(1500) },
          { pageNumber: 2, content: 'b'.repeat(1500) },
          { pageNumber: 3, content: 'c'.repeat(1500) },
          { pageNumber: 4, content: 'd'.repeat(1500) },
          { pageNumber: 5, content: 'e'.repeat(1500) },
          { pageNumber: 6, content: 'f'.repeat(1500) },
          { pageNumber: 7, content: 'g'.repeat(1500) },
          { pageNumber: 8, content: 'h'.repeat(1500) },
          { pageNumber: 9, content: 'i'.repeat(1500) },
          { pageNumber: 10, content: 'j'.repeat(1500) },
          { pageNumber: 11, content: 'k'.repeat(1500) },
          { pageNumber: 12, content: 'l'.repeat(1500) },
          { pageNumber: 13, content: 'm'.repeat(1500) },
          { pageNumber: 14, content: 'n'.repeat(1500) },
        ],
      }),
    ];

    for (const payload of invalidPayloads) {
      expect(codeOf(() => validator.validate(payload, 'child'))).toBe(
        'INVALID_OUTPUT',
      );
    }
  });

  it('blocks child content with banned terms', () => {
    const payload = buildPayload();
    payload.pages[0].content = 'El dragón vio mucha sangre en el bosque.';

    expect(codeOf(() => validator.validate(payload, 'child'))).toBe(
      'CONTENT_BLOCKED',
    );
    expect(validator.validate(payload, 'adult').title).toBe(
      'La aventura del dragón',
    );
  });

  it('does not match banned terms inside larger words', () => {
    const payload = buildPayload();
    payload.pages[0].content = 'El caballero llevaba una armadura brillante.';

    expect(validator.validate(payload, 'child').totalPages).toBe(2);
  });

  it('validates user input before generation, per audience', () => {
    const input = {
      protagonist: 'Un dragón',
      scenery: 'Un bosque',
      mission: 'Quiere matar al ogro',
    };

    expect(codeOf(() => validator.assertInputAllowed(input, 'child'))).toBe(
      'INVALID_REQUEST',
    );
    expect(codeOf(() => validator.assertInputAllowed(input, 'adult'))).toBe(
      undefined,
    );
  });
});
