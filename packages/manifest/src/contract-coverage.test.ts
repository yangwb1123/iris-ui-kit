import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { findRepoRoot } from './discover'

/**
 * Guards the cross-framework behavior-contract harness against silent drift.
 *
 * `@iris-ui/core/contracts` exports a set of framework-agnostic `*Scenario`s;
 * each adapter's `contracts.test` must replay EVERY one of them through its own
 * driver. Nothing else enforces that: a scenario added to core but wired into
 * only three adapters still passes CI (the fourth simply runs fewer tests), so
 * behavioral coverage erodes invisibly. This asserts the full N-scenarios × 4-
 * adapters matrix stays complete — and that no adapter references a scenario the
 * core barrel doesn't export (catches a typo or a renamed/removed scenario).
 */
const ADAPTER_TEST: Record<string, string> = {
  react: 'packages/react/src/contracts.test.tsx',
  vue: 'packages/vue/src/contracts.test.ts',
  solid: 'packages/solid/src/contracts.test.tsx',
  svelte: 'packages/svelte/src/contracts.test.ts',
}

/** Scenario names re-exported from the core contracts barrel. */
function coreScenarios(root: string): Set<string> {
  const text = readFileSync(join(root, 'packages/core/src/contracts/index.ts'), 'utf8')
  const set = new Set<string>()
  for (const m of text.matchAll(/export\s*\{\s*(\w+Scenario)\s*\}/g)) set.add(m[1]!)
  return set
}

/** Scenario names actually replayed (`runContract(<scenario>, …)`) in an adapter test. */
function runScenarios(file: string): Set<string> {
  const text = readFileSync(file, 'utf8')
  const set = new Set<string>()
  for (const m of text.matchAll(/runContract\(\s*(\w+Scenario)/g)) set.add(m[1]!)
  return set
}

describe('cross-framework contract coverage', () => {
  const root = findRepoRoot()
  const core = coreScenarios(root)

  it('core exports a non-trivial set of contract scenarios', () => {
    // Sanity: the regex resolves real exports (guards against a barrel rewrite
    // that silently empties this set, which would make the parity check vacuous).
    expect(core.size).toBeGreaterThan(10)
  })

  for (const [fw, rel] of Object.entries(ADAPTER_TEST)) {
    it(`${fw}: replays every core contract scenario (and no unknown ones)`, () => {
      const file = join(root, rel)
      expect(existsSync(file), `${fw} contracts.test not found at ${rel}`).toBe(true)
      const run = runScenarios(file)

      // Every core scenario must be exercised by this adapter.
      const missing = [...core].filter((s) => !run.has(s)).sort()
      expect(missing, `${fw} is missing contract scenarios`).toEqual([])

      // And the adapter must not reference a scenario the core barrel lacks
      // (typo, or a scenario removed from core but left wired here).
      const unknown = [...run].filter((s) => !core.has(s)).sort()
      expect(unknown, `${fw} references unknown contract scenarios`).toEqual([])
    })
  }
})
