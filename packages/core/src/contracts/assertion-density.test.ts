import { describe, it, expect } from 'vitest'
import * as contracts from './index'

/**
 * Assertion-density guard (Evaluation layer).
 *
 * The cross-framework contract harness measures COVERAGE — every scenario is
 * replayed by all four adapters (see `contract-coverage.test.ts`). But coverage
 * does not imply DISCRIMINATION: a scenario step with `expect: []` performs an
 * action (or none) yet checks nothing, so it passes green even when the behavior
 * under test is completely broken — giving false cross-framework confidence.
 *
 * This guard forbids that: every scenario STEP must assert at least one
 * expectation. A step that asserts nothing should not exist — fold its action
 * into the step that observes the result. (e.g. the in-progress column-resize /
 * cell-edit scenarios each shipped steps with no assertion; this catches them.)
 */
describe('contract assertion density', () => {
  type Step = { label: string; expect: unknown[] }
  type Scenario = { name: string; steps: Step[] }

  const scenarios = Object.entries(contracts).filter((entry): entry is [string, Scenario] => {
    const v = entry[1] as { steps?: unknown }
    return !!v && typeof v === 'object' && Array.isArray(v.steps)
  })

  it('exports a non-trivial set of scenarios (guards a barrel that silently empties)', () => {
    expect(scenarios.length).toBeGreaterThan(20)
  })

  for (const [exportName, scenario] of scenarios) {
    it(`${scenario.name} (${exportName}): every step asserts at least one expectation`, () => {
      const empty = scenario.steps
        .filter((s) => !Array.isArray(s.expect) || s.expect.length === 0)
        .map((s) => s.label)
      expect(empty, `${scenario.name}: these steps assert nothing (expect: [])`).toEqual([])
    })
  }
})
