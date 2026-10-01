import {
  findProfileItemLimitViolations,
  formatLimitViolation,
  toOptionLimitInfo,
} from './limits';
import type {
  Action,
  ActionOption,
  ActionOptionItem,
} from './action.repository';

const action = { id: 'action-1', code: 'create' } as unknown as Action;

function option(
  id: string,
  code: string,
  maxEnabled: number,
  maxPerPage: number,
  items: Array<{ id: string; level: number }>,
): ActionOption {
  return {
    id,
    code,
    maxEnabled,
    maxPerPage,
    items: items.map((item) => ({ ...item }) as unknown as ActionOptionItem),
  } as unknown as ActionOption;
}

describe('findProfileItemLimitViolations (SPEC-023B)', () => {
  const options = toOptionLimitInfo(
    [action],
    new Map([
      [
        action.id,
        [
          option('opt-1', 'protagonist', 2, 1, [
            { id: 'a', level: 1 },
            { id: 'b', level: 2 },
            { id: 'c', level: 1 },
          ]),
        ],
      ],
    ]),
  );

  it('passes when under both limits', () => {
    const current = new Map([
      ['a', true],
      ['b', true],
      ['c', false],
    ]);

    expect(findProfileItemLimitViolations(options, current, [])).toEqual([]);
  });

  it('flags total above max_enabled', () => {
    const current = new Map([
      ['a', true],
      ['b', true],
      ['c', true],
    ]);

    expect(findProfileItemLimitViolations(options, current, [])).toEqual([
      { optionCode: 'protagonist', scope: 'option', limit: 2, actual: 3 },
      {
        optionCode: 'protagonist',
        scope: 'page',
        level: 1,
        limit: 1,
        actual: 2,
      },
    ]);
  });

  it('flags a page above max_per_page', () => {
    const current = new Map([
      ['a', true],
      ['b', false],
      ['c', true],
    ]);

    expect(findProfileItemLimitViolations(options, current, [])).toEqual([
      {
        optionCode: 'protagonist',
        scope: 'page',
        level: 1,
        limit: 1,
        actual: 2,
      },
    ]);
  });

  it('applies partial updates before evaluating', () => {
    const current = new Map([
      ['a', true],
      ['b', false],
      ['c', false],
    ]);

    const violations = findProfileItemLimitViolations(options, current, [
      { itemId: 'b', isEnabled: true },
      { itemId: 'c', isEnabled: true },
    ]);

    expect(violations).toEqual([
      { optionCode: 'protagonist', scope: 'option', limit: 2, actual: 3 },
      {
        optionCode: 'protagonist',
        scope: 'page',
        level: 1,
        limit: 1,
        actual: 2,
      },
    ]);
  });

  it('formats violations for the API error details', () => {
    expect(
      formatLimitViolation({
        optionCode: 'protagonist',
        scope: 'page',
        level: 2,
        limit: 1,
        actual: 3,
      }),
    ).toBe('protagonist (nivel 2): máximo 1, actual 3');
  });
});
