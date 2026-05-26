/**
 * Canonical token names. The IrisTheme type is derived from these constants
 * so that every theme — built-in or user-defined — must define values for
 * the same keys.
 */
export const COLOR_TOKENS = [
  'iris.background',
  'iris.foreground',
  'iris.surface',
  'iris.surface.hover',
  'iris.border',
  'iris.muted',
  'iris.primary',
  'iris.primary.foreground',
  'iris.accent',
  'iris.danger',
  'iris.success',
  'iris.warning',
] as const

export const SPACING_TOKENS = [
  'iris.gap.sm',
  'iris.gap.md',
  'iris.gap.lg',
  'iris.padding.sm',
  'iris.padding.md',
  'iris.padding.lg',
] as const

export const RADII_TOKENS = ['iris.radius.sm', 'iris.radius.md', 'iris.radius.lg'] as const

export type ColorToken = (typeof COLOR_TOKENS)[number]
export type SpacingToken = (typeof SPACING_TOKENS)[number]
export type RadiusToken = (typeof RADII_TOKENS)[number]
export type AnyToken = ColorToken | SpacingToken | RadiusToken

export const ALL_TOKEN_NAMES: readonly AnyToken[] = [
  ...COLOR_TOKENS,
  ...SPACING_TOKENS,
  ...RADII_TOKENS,
]
