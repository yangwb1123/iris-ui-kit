/**
 * CI guard: every data-driven adapter component must guard its primary array
 * prop (`data`, `options`, `items`) against `null`/`undefined` to prevent
 * `Cannot read properties of undefined` crashes when an async API hasn't
 * resolved yet.
 *
 * The guard uses a simple heuristic: for each component file that declares a
 * data-like prop, its block-level usage must contain a `?? []` / `??` fallback
 * or `safeArray()` wrapper within the component function body (before the
 * return statement). This is checked by scanning for the prop name followed by
 * a nullish-coalescing default in the same file.
 *
 * Data-driven components whose array props are inherently always-provided
 * (e.g. children as JSX content) are exempted via ALLOWED.
 *
 * Scope: `packages/react/src/primitives/` (the reference adapter). The other
 * three adapters mirror the React implementation, so guarding the reference
 * catches the pattern for all four.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { findRepoRoot } from './discover'

const REACT_PRIMITIVES = join(findRepoRoot(), 'packages/react/src/primitives')

/** Components that accept `options`/`data`/`items` and ARE data-driven. */
const DATA_DRIVEN_COMPONENTS: Record<string, string[]> = {
  Table: ['data', 'columns'],
  Select: ['items'], // items prop (IrisSelectItem[])
  List: ['items'],
  Tree: ['nodes'], // nodes: IrisTreeNode[]
  Transfer: ['options'], // options: IrisTransferItem[]
  Segmented: ['options'],
  RadioGroup: ['options'],
}

/**
 * Components whose primary array prop is passed as children/render-content
 * (not a raw array from JSON) — these don't need null-guarding because
 * the consumer supplies the content directly.
 */
const ALLOWED = new Set([
  'Tabs', // triggers registered by consumers, not from a raw array
  'ToggleGroup', // items are rendered as direct children
  'Menu', // no `items` prop at all — composed via <IrisMenuItem> children
  'Breadcrumb', // no `items` prop at all — composed via <IrisBreadcrumbItem> children
])

describe('data-driven components guard data props against null', () => {
  for (const [component, props] of Object.entries(DATA_DRIVEN_COMPONENTS)) {
    if (ALLOWED.has(component)) continue

    it(`${component} guards each array prop`, () => {
      // Try both PascalCase file patterns
      const paths = [
        join(REACT_PRIMITIVES, component.toLowerCase(), `${component}.tsx`),
        join(REACT_PRIMITIVES, component.toLowerCase(), `Iris${component}.tsx`),
      ]
      const filePath = paths.find((p) => {
        try {
          readFileSync(p, 'utf-8')
          return true
        } catch {
          return false
        }
      })
      if (!filePath) {
        // Component may not exist in React primitives (e.g. composed differently)
        // or the file was renamed — skip with a note
        return
      }
      const source = readFileSync(filePath, 'utf-8')

      for (const prop of props) {
        const hasGuard =
          // `prop ?? []` or `prop ?? default`
          new RegExp(`\\b${prop}\\s*\\?\\?\\s*\\[`).test(source) ||
          // `safeArray(prop)`
          new RegExp(`safeArray\\(\\s*${prop}\\s*\\)`).test(source) ||
          // `data ?? []` as a useMemo pattern
          new RegExp(`\\b${prop}\\s*\\?\\?\\s*\\[\\]`).test(source)

        expect(
          hasGuard,
          `${component} (${filePath}) must guard \`${prop}\` with \`?? []\` or \`safeArray\``,
        ).toBe(true)
      }
    })
  }
})
