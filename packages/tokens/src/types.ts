import type {
  ColorToken,
  SpacingToken,
  RadiusToken,
  ShadowToken,
  ZIndexToken,
  TransitionToken,
} from './tokens'

export type IrisThemeType = 'light' | 'dark'

export type IrisThemeColors = Record<ColorToken, string>
export type IrisThemeSpacing = Record<SpacingToken, number>
export type IrisThemeRadii = Record<RadiusToken, number>
export type IrisThemeShadows = Record<ShadowToken, string>
export type IrisThemeZIndex = Record<ZIndexToken, number>
export type IrisThemeTransitions = Record<TransitionToken, string>

export interface IrisTheme {
  /** Display name; also used as the key in `createThemeStore`. */
  name: string
  /** Used by primitives that need to know if we're in light or dark mode. */
  type: IrisThemeType
  colors: IrisThemeColors
  spacing: IrisThemeSpacing
  radii: IrisThemeRadii
  shadows?: IrisThemeShadows
  /** Z-index scale for layered UI. Defaults built into each component, overridable here. */
  zIndex?: IrisThemeZIndex
  /** Transition timing tokens for consistent motion. Components use these as fallback defaults. */
  transitions?: IrisThemeTransitions
  /** Name of the icon set to use; resolved by `@iris-ui/icons`. */
  icons?: string
  /** Per-icon alias: semantic name → another registered icon's name (resolved by `@iris-ui/icons`). */
  iconOverrides?: Record<string, string>
}
