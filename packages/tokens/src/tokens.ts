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
  'iris.danger.subtle',
  'iris.success',
  'iris.warning',
  'iris.info',
  'iris.muted.subtle',
  'iris.surface.selected',
  'iris.primary.ghost',
  'iris.font.family',
  'iris.font.mono',
  'iris.font.size.sm',
  'iris.font.size.md',
  'iris.font.size.lg',
] as const

export const SPACING_TOKENS = [
  'iris.gap.sm',
  'iris.gap.md',
  'iris.gap.lg',
  'iris.padding.sm',
  'iris.padding.md',
  'iris.padding.lg',
  'iris.masonry.gap',
  'iris.breadcrumb.gap',
] as const

export const RADII_TOKENS = ['iris.radius.sm', 'iris.radius.md', 'iris.radius.lg'] as const

export const SHADOW_TOKENS = ['iris.shadow.sm', 'iris.shadow.md', 'iris.shadow.lg'] as const

export const ZINDEX_TOKENS = [
  'iris.z.dropdown',
  'iris.z.sticky',
  'iris.z.fixed',
  'iris.z.modalBackdrop',
  'iris.z.modal',
  'iris.z.popover',
  'iris.z.tooltip',
  'iris.z.toast',
] as const

export const TRANSITION_TOKENS = [
  'iris.transition.fast',
  'iris.transition.normal',
  'iris.transition.slow',
  'iris.transition.ease',
  'iris.transition.spring',
] as const

export type ColorToken = (typeof COLOR_TOKENS)[number]
export type SpacingToken = (typeof SPACING_TOKENS)[number]
export type RadiusToken = (typeof RADII_TOKENS)[number]
export type ShadowToken = (typeof SHADOW_TOKENS)[number]
export type ZIndexToken = (typeof ZINDEX_TOKENS)[number]
export type TransitionToken = (typeof TRANSITION_TOKENS)[number]
export type AnyToken =
  | ColorToken
  | SpacingToken
  | RadiusToken
  | ShadowToken
  | ZIndexToken
  | TransitionToken

export const ALL_TOKEN_NAMES: readonly AnyToken[] = [
  ...COLOR_TOKENS,
  ...SPACING_TOKENS,
  ...RADII_TOKENS,
  ...SHADOW_TOKENS,
  ...ZINDEX_TOKENS,
  ...TRANSITION_TOKENS,
]
