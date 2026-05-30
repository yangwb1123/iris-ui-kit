import { toCssVarName } from '@iris-ui/theme'
import type { ResolvedSkin } from './types'

/** All CSS-var entries for a resolved skin: core theme tokens + custom tokens (numbers → px). */
export function skinToCssEntries(resolved: ResolvedSkin): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const [k, v] of Object.entries(resolved.theme.colors)) out.push([toCssVarName(k), v])
  for (const [k, v] of Object.entries(resolved.theme.spacing)) out.push([toCssVarName(k), `${v}px`])
  for (const [k, v] of Object.entries(resolved.theme.radii)) out.push([toCssVarName(k), `${v}px`])
  for (const [k, v] of Object.entries(resolved.custom)) {
    out.push([toCssVarName(k), typeof v === 'number' ? `${v}px` : v])
  }
  return out
}

/** Render a resolved skin as a CSS rule string. Pure — safe on the server (SSR/FOUC). */
export function renderSkinStyle(resolved: ResolvedSkin, selector = ':root'): string {
  const body = skinToCssEntries(resolved)
    .map(([n, v]) => `${n}:${v}`)
    .join(';')
  return `${selector}{${body}}`
}
