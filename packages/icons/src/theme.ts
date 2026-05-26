import type { IrisIcon } from './types'
import type { IrisIconRegistry } from './registry'

/**
 * Minimal theme shape consumed for icon resolution — structurally a subset of
 * `IrisTheme`, so passing a full theme works without importing `@iris-ui/tokens`.
 */
export interface ThemeIconConfig {
  /** Active icon set name (takes effect only when registered). */
  icons?: string
  /** Per-icon alias: semantic name → another registered icon's name. */
  iconOverrides?: Record<string, string>
}

/**
 * Resolve an icon honoring a theme's icon config:
 *   1. `iconOverrides` remaps the requested name to another icon's name (alias).
 *   2. `icons` selects a preferred set; falls back to the registry's normal
 *      resolution when that set lacks the (aliased) glyph.
 *
 * Overrides are icon *names*, never markup — safe by construction (no XSS).
 */
export function resolveThemedIcon(
  registry: IrisIconRegistry,
  name: string,
  theme?: ThemeIconConfig,
): IrisIcon | undefined {
  const resolvedName = theme?.iconOverrides?.[name] ?? name
  if (theme?.icons) {
    const fromSet = registry.getSet(theme.icons)?.icons[resolvedName]
    if (fromSet) return fromSet
  }
  return registry.resolve(resolvedName)
}
