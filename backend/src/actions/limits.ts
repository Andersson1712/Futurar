import type {
  Action,
  ActionOption,
  ProfileItemInput,
} from './action.repository';

export interface ProfileItemLimitViolation {
  optionCode: string;
  scope: 'option' | 'page';
  level?: number;
  limit: number;
  actual: number;
}

export interface OptionLimitInfo {
  code: string;
  maxEnabled: number;
  maxPerPage: number;
  /** itemId -> level for the items that belong to this option. */
  levels: Map<string, number>;
}

export function toOptionLimitInfo(
  actions: Action[],
  optionsByAction: Map<string, ActionOption[]>,
): OptionLimitInfo[] {
  const info: OptionLimitInfo[] = [];

  for (const action of actions) {
    for (const option of optionsByAction.get(action.id) ?? []) {
      const levels = new Map<string, number>();

      for (const item of option.items) {
        levels.set(item.id, item.level);
      }

      info.push({
        code: option.code,
        maxEnabled: option.maxEnabled,
        maxPerPage: option.maxPerPage,
        levels,
      });
    }
  }

  return info;
}

/**
 * SPEC-023B: given the current enabled state and a partial update, returns every
 * violation of `max_enabled` (total per option) or `max_per_page` (per level).
 */
export function findProfileItemLimitViolations(
  options: OptionLimitInfo[],
  currentEnabled: Map<string, boolean>,
  inputs: ProfileItemInput[],
): ProfileItemLimitViolation[] {
  const resulting = new Map(currentEnabled);

  for (const input of inputs) {
    resulting.set(input.itemId, input.isEnabled);
  }

  const violations: ProfileItemLimitViolation[] = [];

  for (const option of options) {
    const enabledPerLevel = new Map<number, number>();
    let total = 0;

    for (const [itemId, level] of option.levels) {
      if (resulting.get(itemId) !== true) continue;

      total += 1;
      enabledPerLevel.set(level, (enabledPerLevel.get(level) ?? 0) + 1);
    }

    if (total > option.maxEnabled) {
      violations.push({
        optionCode: option.code,
        scope: 'option',
        limit: option.maxEnabled,
        actual: total,
      });
    }

    for (const [level, count] of enabledPerLevel) {
      if (count > option.maxPerPage) {
        violations.push({
          optionCode: option.code,
          scope: 'page',
          level,
          limit: option.maxPerPage,
          actual: count,
        });
      }
    }
  }

  return violations;
}

export function formatLimitViolation(
  violation: ProfileItemLimitViolation,
): string {
  const suffix =
    violation.scope === 'page' ? ` (nivel ${violation.level ?? 1})` : '';

  return `${violation.optionCode}${suffix}: máximo ${violation.limit}, actual ${violation.actual}`;
}
