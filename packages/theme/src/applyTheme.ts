import type { IrisTheme } from '@iris-ui/tokens'
import { hexToRgba, rgbToHex } from '@iris-ui/core'
import { toCssVarName } from './toCssVarName'
import { applyCssVars, type CssVarEntries } from './applyCssVars'

export interface ApplyThemeResult {
  /** Restore the previously set inline custom property values on `target`. */
  revert(): void
}

// Semantic colors that get a precomputed tonal "subtle" variant, and the weight
// (≈14%) at which the color is composited over the background.
const SUBTLE_SOURCES = ['iris.primary', 'iris.success', 'iris.warning', 'iris.danger', 'iris.muted']
const SUBTLE_WEIGHT = 0.14

/** Composite `colorHex` over `bgHex` at `weight` (opaque result). */
function mixOver(colorHex: string, bgHex: string, weight: number): string | null {
  const c = hexToRgba(colorHex)
  const b = hexToRgba(bgHex)
  if (!c || !b) return null
  const ch = (k: 'r' | 'g' | 'b'): number => Math.round(c[k] * weight + b[k] * (1 - weight))
  return rgbToHex({ r: ch('r'), g: ch('g'), b: ch('b'), a: 1 })
}

export function themeCssVarEntries(theme: IrisTheme): CssVarEntries {
  const out: CssVarEntries = []
  const colors = theme.colors as Record<string, string>
  for (const [key, value] of Object.entries(colors)) {
    out.push([toCssVarName(key), value])
  }
  const bg = colors['iris.background']
  if (bg) {
    for (const key of SUBTLE_SOURCES) {
      const subtle = colors[key] ? mixOver(colors[key], bg, SUBTLE_WEIGHT) : null
      if (subtle) out.push([toCssVarName(`${key}.subtle`), subtle])
    }
  }
  for (const [key, value] of Object.entries(theme.spacing)) {
    out.push([toCssVarName(key), `${value}px`])
  }
  for (const [key, value] of Object.entries(theme.radii)) {
    out.push([toCssVarName(key), `${value}px`])
  }
  if (theme.shadows) {
    for (const [key, value] of Object.entries(theme.shadows)) {
      out.push([toCssVarName(key), value])
    }
  }
  if (theme.zIndex) {
    for (const [key, value] of Object.entries(theme.zIndex)) {
      out.push([toCssVarName(key), String(value)])
    }
  }
  if (theme.transitions) {
    for (const [key, value] of Object.entries(theme.transitions)) {
      out.push([toCssVarName(key), value])
    }
  }
  return out
}

/**
 * Write a theme to the target element as inline CSS custom properties.
 * Returns a `revert()` function that restores prior values — useful for
 * nested themes or SSR re-mounting.
 *
 * SSR-safe: no-ops when `target` is omitted and `document` is not defined.
 *
 * Pure DOM. No framework dependency. Vue/React/Solid adapters call this.
 * Delegates the var write to `applyCssVars` (the path shared with `applySkin`).
 */
export function applyTheme(theme: IrisTheme, target?: HTMLElement | null): ApplyThemeResult {
  const el = target ?? (typeof document !== 'undefined' ? document.documentElement : null)
  if (!el) return { revert: () => {} }
  const applied = applyCssVars(themeCssVarEntries(theme), el)

  const prevThemeName = el.getAttribute('data-iris-theme')
  const prevThemeType = el.getAttribute('data-iris-theme-type')
  el.setAttribute('data-iris-theme', theme.name)
  el.setAttribute('data-iris-theme-type', theme.type)

  return {
    revert() {
      applied.revert()
      if (prevThemeName === null) {
        el.removeAttribute('data-iris-theme')
      } else {
        el.setAttribute('data-iris-theme', prevThemeName)
      }
      if (prevThemeType === null) {
        el.removeAttribute('data-iris-theme-type')
      } else {
        el.setAttribute('data-iris-theme-type', prevThemeType)
      }
    },
  }
}
