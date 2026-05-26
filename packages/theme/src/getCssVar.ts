import { toCssVarName } from './toCssVarName'

/**
 * Wrap a token key in a CSS `var(...)` reference.
 *
 * @example
 * getCssVar('iris.primary')              // 'var(--iris-primary)'
 * getCssVar('iris.primary', '#000')      // 'var(--iris-primary, #000)'
 */
export function getCssVar(token: string, fallback?: string): string {
  const name = toCssVarName(token)
  return fallback === undefined ? `var(${name})` : `var(${name}, ${fallback})`
}
