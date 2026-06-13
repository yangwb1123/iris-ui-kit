import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { discover, findRepoRoot } from './discover'
import { buildManifest } from './build'

/**
 * Guards a real class of bug: a component implemented + tested (its tests import
 * via relative paths) but NOT re-exported from the package's public barrel — so
 * consumers can't import it, and no existing test catches it. This asserts every
 * discovered non-plugin component is reachable from each adapter's `index.ts`.
 */
const ADAPTER_SRC: Record<string, string> = {
  react: 'packages/react/src',
  vue: 'packages/vue/src',
  solid: 'packages/solid/src',
  svelte: 'packages/svelte/src',
}

/** Collect every `Iris*` name reachable from a barrel, following `export *` one level deep. */
function barrelNames(entryFile: string): Set<string> {
  const seen = new Set<string>()
  const visited = new Set<string>()
  const scan = (file: string): void => {
    if (visited.has(file) || !existsSync(file)) return
    visited.add(file)
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const part of m[1]!.split(',')) {
        const name = (part.split(/\s+as\s+/).pop() ?? '').trim()
        if (/^Iris[A-Za-z0-9]+$/.test(name)) seen.add(name)
      }
    }
    for (const m of text.matchAll(/export\s+(?:const|function|class)\s+(Iris[A-Za-z0-9]+)/g)) {
      seen.add(m[1]!)
    }
    for (const m of text.matchAll(/export\s*\*\s*from\s*['"]([^'"]+)['"]/g)) {
      const base = join(dirname(file), m[1]!)
      const target = [
        `${base}.ts`,
        `${base}.tsx`,
        join(base, 'index.ts'),
        join(base, 'index.tsx'),
      ].find(existsSync)
      if (target) scan(target)
    }
  }
  scan(entryFile)
  return seen
}

describe('barrel reachability', () => {
  const root = findRepoRoot()
  const manifest = buildManifest(discover())

  for (const [fw, src] of Object.entries(ADAPTER_SRC)) {
    it(`${fw}: every discovered component is re-exported from the package barrel`, () => {
      // The package entry is index.ts (react/vue/svelte) or index.tsx (solid).
      const entry = [join(root, src, 'index.ts'), join(root, src, 'index.tsx')].find(existsSync)
      expect(entry, `${fw} barrel entry not found`).toBeDefined()
      const exported = barrelNames(entry!)
      const components = manifest.components
        .filter((c) => c.frameworks.includes(fw) && c.group !== 'plugin')
        .map((c) => c.name)
      const unreachable = components.filter((name) => !exported.has(name))
      expect(unreachable).toEqual([])
    })
  }
})

/**
 * Guards test-coverage drift: every primitive component MODULE must ship with a
 * test file beside it. Component tests import via relative paths, so an entirely
 * untested module otherwise passes CI silently (as happened for 5 solid + 5
 * svelte modules before they were backfilled).
 */
describe('module test coverage', () => {
  const root = findRepoRoot()
  for (const [fw, src] of Object.entries(ADAPTER_SRC)) {
    it(`${fw}: every primitive module has a test file`, () => {
      const primitives = join(root, src, 'primitives')
      const untested = readdirSync(primitives, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .filter((e) => {
          const files = readdirSync(join(primitives, e.name))
          return !files.some((f) => /\.test\.(ts|tsx)$/.test(f))
        })
        .map((e) => e.name)
      expect(untested).toEqual([])
    })
  }
})

/**
 * Guards CSS-variable typos: a `var(--iris-typo)` reference WITHOUT a fallback
 * silently renders as nothing (invalid → ignored), a bug no test catches. Every
 * no-fallback `var(--iris-*)` in component source must resolve to a theme-defined
 * token (or the derived `-subtle` vars). References WITH a fallback are exempt.
 */
describe('css variable reference validity', () => {
  const root = findRepoRoot()
  const definedTokenVars = (): Set<string> => {
    const light = readFileSync(join(root, 'packages/tokens/src/light.ts'), 'utf8')
    const set = new Set<string>()
    for (const m of light.matchAll(/['"]iris\.([a-zA-Z.]+)['"]/g)) {
      set.add(`--iris-${m[1]!.replace(/\./g, '-')}`)
    }
    for (const s of ['primary', 'success', 'warning', 'danger', 'muted'])
      set.add(`--iris-${s}-subtle`)
    return set
  }
  const noFallbackRefs = (dir: string): Set<string> => {
    const refs = new Set<string>()
    const walk = (d: string): void => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        const p = join(d, e.name)
        if (e.isDirectory()) walk(p)
        else if (/\.(tsx|ts|svelte)$/.test(e.name) && !e.name.includes('.test.')) {
          for (const m of readFileSync(p, 'utf8').matchAll(
            /var\(\s*(--iris-[a-zA-Z0-9-]+)\s*\)/g,
          )) {
            refs.add(m[1]!)
          }
        }
      }
    }
    walk(dir)
    return refs
  }

  const defined = definedTokenVars()
  for (const [fw, src] of Object.entries(ADAPTER_SRC)) {
    it(`${fw}: every no-fallback var(--iris-*) resolves to a defined token`, () => {
      const undefinedRefs = [...noFallbackRefs(join(root, src, 'primitives'))]
        .filter((v) => !defined.has(v))
        .sort()
      expect(undefinedRefs).toEqual([])
    })
  }
})
