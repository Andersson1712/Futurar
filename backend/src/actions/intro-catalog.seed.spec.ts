import {
  INTRO_ACTIONS,
  INTRO_ITEMS,
  INTRO_OPTIONS,
} from './intro-catalog.seed';

describe('intro-catalog.seed (SPEC-023C)', () => {
  it('pins the three introductory actions', () => {
    expect(INTRO_ACTIONS.map((action) => action.code)).toEqual([
      'create',
      'library',
      'design',
    ]);
    expect(INTRO_ACTIONS.map((action) => action.label)).toEqual([
      'Crear Cuento',
      'Mi Biblioteca',
      'Diseñar',
    ]);
  });

  it('pins the four story options', () => {
    expect(INTRO_OPTIONS.map((option) => option.code)).toEqual([
      'protagonist',
      'scenario',
      'mission',
      'style',
    ]);
  });

  it('pins the 79 introductory items', () => {
    expect(INTRO_ITEMS).toHaveLength(79);
  });

  it('covers every option with spot labels per level', () => {
    const labelsFor = (optionCode: string, level: number): string[] =>
      INTRO_ITEMS.filter(
        (item) => item.optionCode === optionCode && item.level === level,
      ).map((item) => item.label);

    expect(labelsFor('protagonist', 1)).toContain('León');
    expect(labelsFor('protagonist', 8)).toContain('Explorador/a');
    expect(labelsFor('scenario', 1)).toContain('Un bosque encantado');
    expect(labelsFor('scenario', 4)).toContain(
      'Interior de una juguetería de noche',
    );
    expect(labelsFor('mission', 1)).toContain('El tesoro escondido');
    expect(labelsFor('mission', 4)).toContain(
      'Defender al mundo de extraterrestres',
    );
    expect(labelsFor('style', 1)).toEqual(
      expect.arrayContaining([
        'Dibujos animados',
        'Acuarela',
        'Pixel art',
        'Cómics y superhéroes',
        'Plastilina',
      ]),
    );
  });

  it('distributes items across options and levels', () => {
    const countFor = (optionCode: string): number =>
      INTRO_ITEMS.filter((item) => item.optionCode === optionCode).length;

    expect(countFor('protagonist')).toBe(39);
    expect(countFor('scenario')).toBe(18);
    expect(countFor('mission')).toBe(16);
    expect(countFor('style')).toBe(6);

    const levelsFor = (optionCode: string): number[] =>
      [
        ...new Set(
          INTRO_ITEMS.filter((item) => item.optionCode === optionCode).map(
            (item) => item.level,
          ),
        ),
      ].sort((a, b) => a - b);

    expect(levelsFor('protagonist')).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(levelsFor('scenario')).toEqual([1, 2, 3, 4]);
    expect(levelsFor('mission')).toEqual([1, 2, 3, 4]);
    expect(levelsFor('style')).toEqual([1]);
  });
});
