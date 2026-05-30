import { applyCssVars, type ApplyCssVarsResult } from '@iris-ui/theme'
import type { ResolvedSkin } from './types'
import { skinToCssEntries } from './renderSkinStyle'

export interface ApplySkinResult {
  revert(): void
}

/**
 * Apply a resolved skin to a target element as inline CSS custom properties
 * (core theme + custom tokens) plus `data-iris-skin` / `data-iris-skin-type`.
 * Reuses the theme layer's `applyCssVars`. Returns `revert()`.
 */
export function applySkin(
  resolved: ResolvedSkin,
  target: HTMLElement = document.documentElement,
): ApplySkinResult {
  const applied: ApplyCssVarsResult = applyCssVars(skinToCssEntries(resolved), target)
  const prevId = target.getAttribute('data-iris-skin')
  const prevType = target.getAttribute('data-iris-skin-type')
  target.setAttribute('data-iris-skin', resolved.id)
  target.setAttribute('data-iris-skin-type', resolved.type)
  return {
    revert() {
      applied.revert()
      if (prevId === null) target.removeAttribute('data-iris-skin')
      else target.setAttribute('data-iris-skin', prevId)
      if (prevType === null) target.removeAttribute('data-iris-skin-type')
      else target.setAttribute('data-iris-skin-type', prevType)
    },
  }
}
