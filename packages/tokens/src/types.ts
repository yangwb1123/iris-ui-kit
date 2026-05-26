import type { ColorToken, SpacingToken, RadiusToken } from './tokens'

export type IrisThemeType = 'light' | 'dark'

export type IrisThemeColors = Record<ColorToken, string>
export type IrisThemeSpacing = Record<SpacingToken, number>
export type IrisThemeRadii = Record<RadiusToken, number>

export interface IrisTheme {
  /** Display name; also used as the key in `createThemeStore`. */
  name: string
  /** Used by primitives that need to know if we're in light or dark mode. */
  type: IrisThemeType
  colors: IrisThemeColors
  spacing: IrisThemeSpacing
  radii: IrisThemeRadii
  /** Name of the icon set to use; resolved by `@iris-ui/icons`. */
  icons?: string
  /** Per-icon alias: semantic name → another registered icon's name (resolved by `@iris-ui/icons`). */
  iconOverrides?: Record<string, string>
}
