/**
 * Convert a dot-notation token key to a CSS variable name.
 *
 * @example
 * toCssVarName('iris.background')      // '--iris-background'
 * toCssVarName('iris.gap.md')          // '--iris-gap-md'
 */
export function toCssVarName(token: string): string {
  return `--${token.replace(/\./g, '-')}`
}
