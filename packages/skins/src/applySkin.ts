import { applyCssVars, type ApplyCssVarsResult } from '@iris-ui-kit/theme'
import type { ResolvedSkin } from './types'
import { skinToCssEntries } from './renderSkinStyle'

export interface ApplySkinResult {
  revert(): void
}

/**
 * Apply a resolved skin to a target element as inline CSS custom properties
 * (core theme + custom tokens) plus `data-iris-skin` / `data-iris-skin-type`.
 * Reuses the theme layer's `applyCssVars`. Returns `revert()`.
 *
 * SSR-safe: when `target` is omitted and `document` is not defined (Node.js),
 * returns a no-op `{ revert }`.
 */
export function applySkin(resolved: ResolvedSkin, target?: HTMLElement | null): ApplySkinResult {
  const el = target ?? (typeof document !== 'undefined' ? document.documentElement : null)
  if (!el) return { revert: () => {} }
  const applied: ApplyCssVarsResult = applyCssVars(skinToCssEntries(resolved), el)
  const prevId = el.getAttribute('data-iris-skin')
  const prevType = el.getAttribute('data-iris-skin-type')
  el.setAttribute('data-iris-skin', resolved.id)
  el.setAttribute('data-iris-skin-type', resolved.type)
  return {
    revert() {
      applied.revert()
      if (prevId === null) el.removeAttribute('data-iris-skin')
      else el.setAttribute('data-iris-skin', prevId)
      if (prevType === null) el.removeAttribute('data-iris-skin-type')
      else el.setAttribute('data-iris-skin-type', prevType)
    },
  }
}
