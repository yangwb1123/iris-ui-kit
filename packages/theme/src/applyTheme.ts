import type { IrisTheme } from '@iris-ui/tokens'
import { toCssVarName } from './toCssVarName'
import { applyCssVars, type CssVarEntries } from './applyCssVars'

export interface ApplyThemeResult {
  /** Restore the previously set inline custom property values on `target`. */
  revert(): void
}

function collectEntries(theme: IrisTheme): CssVarEntries {
  const out: CssVarEntries = []
  for (const [key, value] of Object.entries(theme.colors)) {
    out.push([toCssVarName(key), value])
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
  const applied = applyCssVars(collectEntries(theme), target)

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
