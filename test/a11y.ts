import * as axe from 'axe-core';
import { expect } from 'vitest';

// jsdom has no layout: color-contrast cannot run here (covered by
// utils/contrast.test.ts). Region/landmark rules assume a full page while we
// audit isolated components.
const DISABLED_RULES: axe.RunOptions['rules'] = {
  'color-contrast': { enabled: false },
  region: { enabled: false },
  'landmark-one-main': { enabled: false },
  'page-has-heading-one': { enabled: false },
};

export async function expectNoA11yViolations(
  container: HTMLElement,
): Promise<void> {
  const results = await axe.run(container, { rules: DISABLED_RULES });
  const summary = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.help} (${violation.nodes.length} nodos)`,
  );

  expect(summary).toEqual([]);
}
