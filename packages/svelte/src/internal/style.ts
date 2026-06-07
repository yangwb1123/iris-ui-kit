/**
 * Shared CSS-string helpers. Svelte's `style` attribute takes a STRING (unlike
 * React/Vue/Solid which accept a style object), so layouts build their inline
 * styles as strings via these helpers instead of repeating the object→string
 * dance in every component. (Button keeps its own copy in button/styles.ts.)
 */

/** Number → `px`; strings pass through. */
export const asLen = (v: number | string): string => (typeof v === 'number' ? `${v}px` : v)

/** Spacing token (`sm`/`md`/`lg`) → CSS var; number → px; anything else verbatim. */
export function toCssSpacing(spacing: string | number): string {
  if (typeof spacing === 'number') return `${spacing}px`
  if (spacing === 'sm' || spacing === 'md' || spacing === 'lg') return `var(--iris-gap-${spacing})`
  return spacing
}

/** Object → inline CSS string; drops `undefined`/`''` so optional props omit cleanly. */
export function styleToString(style: Record<string, string | number | undefined>): string {
  return Object.entries(style)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ')
}

/** Append a user-supplied style string after the base (later declarations win). */
export const mergeStyle = (base: string, user?: string | null): string =>
  user ? `${base}; ${user}` : base
