export type CssVarEntries = Array<[string, string]>

export interface ApplyCssVarsResult {
  /** Restore the previously set inline custom property values on `target`. */
  revert(): void
}

/**
 * Write `[cssVarName, value]` pairs to a target element as inline custom
 * properties, returning a `revert()` that restores the prior values (removing
 * the ones that were previously unset). Pure DOM, no framework dependency —
 * the single write-path shared by `applyTheme` and `@iris-ui-kit/skins`' `applySkin`.
 */
export function applyCssVars(entries: CssVarEntries, target: HTMLElement): ApplyCssVarsResult {
  const previous: CssVarEntries = []
  for (const [name, value] of entries) {
    previous.push([name, target.style.getPropertyValue(name)])
    target.style.setProperty(name, value)
  }
  return {
    revert() {
      for (const [name, value] of previous) {
        if (value === '') target.style.removeProperty(name)
        else target.style.setProperty(name, value)
      }
    },
  }
}
