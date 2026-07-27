import type { IrisTheme } from '@iris-ui-kit/tokens'
import { themeCssVarEntries } from './applyTheme'

export interface ThemeToCssOptions {
  /** CSS selector for the rule. Default `':root'`. Use `[data-iris-theme="…"]` to scope a second theme. */
  selector?: string
}

/**
 * Serialize a theme to a STATIC CSS custom-property rule — the same var names
 * and values {@link applyTheme} writes at runtime (they share
 * {@link themeCssVarEntries}), but as text rather than a DOM mutation.
 *
 * Use it where JS can't run the runtime injection: SSR/critical-CSS extraction,
 * a `.css` design-handoff artifact, or a non-JS consumer. Pair with
 * `toDtcg` (the design-tool JSON format) for full token interop.
 *
 * @example
 * ```ts
 * themeToCss(lightTheme)
 * // :root {
 * //   --iris-background: #ffffff;
 * //   --iris-gap-sm: 4px;
 * //   …
 * // }
 * themeToCss(darkTheme, { selector: '[data-iris-theme="iris-dark"]' })
 * ```
 */
export function themeToCss(theme: IrisTheme, options: ThemeToCssOptions = {}): string {
  const selector = options.selector ?? ':root'
  const body = themeCssVarEntries(theme)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n')
  return `${selector} {\n${body}\n}`
}
