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

/**
 * The CSS-custom-property `[name, value]` entries for a theme — colors as-is,
 * spacing/radii suffixed with `px`. The single source of truth shared by the
 * runtime {@link applyTheme} and the static {@link themeToCss} export, so both
 * always emit identical var names and values.
 *
 * Also emits a `--iris-{name}-subtle` per semantic color (the color composited
 * ~14% over the background). Components use it as the static fallback under
 * `color-mix()` so tonal surfaces still tint on engines without color-mix
 * (pre-2022 WebKitGTK / WKWebView) — modern engines keep the exact color-mix.
 */
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
  return out
}

/**
 * Write a theme to the target element as inline CSS custom properties.
 * Returns a `revert()` function that restores prior values — useful for
 * nested themes or SSR re-mounting.
 *
 * Pure DOM. No framework dependency. Vue/React/Solid adapters call this.
 * Delegates the var write to `applyCssVars` (the path shared with `applySkin`).
 */
export function applyTheme(
  theme: IrisTheme,
  target: HTMLElement = document.documentElement,
): ApplyThemeResult {
  const applied = applyCssVars(themeCssVarEntries(theme), target)

  const prevThemeName = target.getAttribute('data-iris-theme')
  const prevThemeType = target.getAttribute('data-iris-theme-type')
  target.setAttribute('data-iris-theme', theme.name)
  target.setAttribute('data-iris-theme-type', theme.type)

  return {
    revert() {
      applied.revert()
      if (prevThemeName === null) {
        target.removeAttribute('data-iris-theme')
      } else {
        target.setAttribute('data-iris-theme', prevThemeName)
      }
      if (prevThemeType === null) {
        target.removeAttribute('data-iris-theme-type')
      } else {
        target.setAttribute('data-iris-theme-type', prevThemeType)
      }
    },
  }
}
