import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { findRepoRoot } from './discover'

/**
 * Guards two source-hygiene invariants the library currently upholds perfectly
 * (verified zero violations) — so they stay enforced rather than aspirational:
 *
 *  1. No TypeScript escape hatches (`as any`, `@ts-ignore`, `@ts-expect-error`)
 *     in shippable source. Each silently disables the type checker and is a
 *     classic hiding place for a real bug; the codebase proves they're avoidable.
 *  2. No inline `TODO` / `FIXME` / `XXX` / `HACK` markers — abandoned-work debt
 *     belongs in `docs/TODO.md` (the factory's tracked backlog), not scattered
 *     through source where it rots invisibly.
 *
 * Scope: every package's `src`, EXCLUDING tests, demos, examples, build scripts,
 * and generators (those legitimately use looser conventions). If a genuine need
 * for an escape hatch ever arises, add it to `ALLOWED` with a justification —
 * the same explicit-exception philosophy as the other guards.
 */
const PKsrc = 'packages'
const SKIP_DIR = new Set([
  'node_modules',
  'dist',
  'demo',
  'demos',
  'examples',
  'scripts',
  '__tests__',
])
const SKIP_FILE = /\.(test|spec|stories)\.[tj]sx?$|\.d\.ts$/
const SOURCE_EXT = /\.(ts|tsx|svelte)$/

/** Files with a vetted, documented reason to be exempt (path suffix → why). */
const ALLOWED: Record<string, string> = {
  // No current exceptions. Example shape if ever needed:
  // Keep entries below sorted by relative path.
  'packages/core/src/form.ts':
    'createDirtyGuard: as any casts for beforeunload event (deprecated returnValue + globalThis addEventListener) + resolveValidator: as any casts for dynamic validator key lookup across Key<V> type bounds',
  'packages/core/src/form.bench.ts':
    'as any casts for form store type erasure in benchmark helper',
  'packages/plugin-pro-table/src/solid/index.tsx':
    'SolidJS style prop exceeds TS complexity limit (TS2590); cast is scoped inline',
}

const ESCAPE_HATCH = /\bas any\b|@ts-ignore|@ts-expect-error/
const WORK_MARKER = /\b(?:TODO|FIXME|XXX|HACK)\b/

function collectSourceFiles(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (!SKIP_DIR.has(e.name)) walk(join(dir, e.name))
      } else if (SOURCE_EXT.test(e.name) && !SKIP_FILE.test(e.name)) {
        out.push(join(dir, e.name))
      }
    }
  }
  // Only each package's own src/ (skips package roots, configs, generated dist).
  for (const pkg of readdirSync(join(root, PKsrc), { withFileTypes: true })) {
    if (!pkg.isDirectory()) continue
    const src = join(root, PKsrc, pkg.name, 'src')
    try {
      walk(src)
    } catch {
      // package has no src/ (e.g. config-only) — skip
    }
  }
  return out
}

describe('source hygiene', () => {
  const root = findRepoRoot()
  const files = collectSourceFiles(root)

  it('scans a representative slice of the source tree', () => {
    // Sanity: the walker actually found source (guards against a path/glob
    // mistake silently making the checks below vacuous).
    expect(files.length).toBeGreaterThan(200)
  })

  it('has no TypeScript escape hatches (as any / @ts-ignore / @ts-expect-error)', () => {
    const offenders: string[] = []
    for (const f of files) {
      const rel = f.slice(root.length + 1)
      if (rel in ALLOWED) continue
      const text = readFileSync(f, 'utf8')
      text.split('\n').forEach((line, i) => {
        // Ignore matches inside line comments (a comment mentioning the pattern
        // is documentation, not a real escape hatch).
        const code = line.replace(/\/\/.*$/, '')
        if (ESCAPE_HATCH.test(code)) offenders.push(`${rel}:${i + 1}`)
      })
    }
    expect(offenders).toEqual([])
  })

  it('has no inline TODO/FIXME/XXX/HACK markers (use docs/TODO.md instead)', () => {
    const offenders: string[] = []
    for (const f of files) {
      const rel = f.slice(root.length + 1)
      const text = readFileSync(f, 'utf8')
      text.split('\n').forEach((line, i) => {
        // Only flag markers inside a comment (avoids matching e.g. a string
        // literal that legitimately contains the word "TODO" as content).
        const m = line.match(/(?:\/\/|\/\*|\*)\s*(.*)$/)
        if (m && WORK_MARKER.test(m[1]!)) offenders.push(`${rel}:${i + 1}`)
      })
    }
    expect(offenders).toEqual([])
  })
})
