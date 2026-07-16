import { toCssVarName } from '@iris-ui/theme'
import type { ResolvedSkin } from './types'

// Skins can be loaded from a remote URL (see loadSkin), so a skin's custom
// token names/values are only semi-trusted. When a skin is rendered to a CSS
// *string* (SSR / bootScript) and injected into a <style> element, a value or
// name containing `;`, `}`, `<`, or a comment marker could terminate the
// declaration/rule or break out of the element entirely. Constrain both.

/** A CSS custom-property name Iris emits: `--` then word/dash characters only. */
const SAFE_VAR_NAME = /^--[A-Za-z0-9_-]+$/

/**
 * Strip characters a single CSS property value never legitimately needs but
 * which could terminate the declaration/rule or break out of a `<style>`
 * element (`;{}<>` and comment markers). Colors, lengths, `calc()`, `url()`,
 * font stacks and shadows are unaffected.
 */
function sanitizeCssValue(value: string): string {
  return value
    .replace(/[<>{};]/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
}

/** All CSS-var entries for a resolved skin: core theme tokens + custom tokens (numbers → px). */
export function skinToCssEntries(resolved: ResolvedSkin): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const push = (name: string, value: string): void => {
    if (SAFE_VAR_NAME.test(name)) out.push([name, sanitizeCssValue(value)])
  }
  for (const [k, v] of Object.entries(resolved.theme.colors)) push(toCssVarName(k), v)
  for (const [k, v] of Object.entries(resolved.theme.spacing)) push(toCssVarName(k), `${v}px`)
  for (const [k, v] of Object.entries(resolved.theme.radii)) push(toCssVarName(k), `${v}px`)
  for (const [k, v] of Object.entries(resolved.custom)) {
    push(toCssVarName(k), typeof v === 'number' ? `${v}px` : v)
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
