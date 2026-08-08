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
  'iris.danger.foreground',
  'iris.danger.subtle',
  'iris.success',
  'iris.success.foreground',
  'iris.warning',
  'iris.warning.foreground',
  'iris.info',
  'iris.info.foreground',
  'iris.on.color',
  'iris.muted.subtle',
  'iris.surface.selected',
  'iris.surface.floating',
  'iris.primary.ghost',
  'iris.backdrop',
  'iris.font.family',
  'iris.font.mono',
  'iris.font.size.xs',
  'iris.font.size.sm',
  'iris.font.size.md',
  'iris.font.size.base',
  'iris.font.size.lg',
  'iris.font.size.xl',
  'iris.font.size.2xl',
  'iris.font.size.3xl',
  'iris.font.size.4xl',
  'iris.font.weight.regular',
  'iris.font.weight.medium',
  'iris.font.weight.semibold',
  'iris.font.weight.bold',
  'iris.font.line.height.sm',
  'iris.font.line.height.md',
  'iris.font.line.height.lg',
  'iris.font.letter.spacing.tight',
  'iris.font.letter.spacing.normal',
  'iris.font.letter.spacing.wide',
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
  'iris.space.xxs',
  'iris.space.xs',
  'iris.space.sm',
  'iris.space.md',
  'iris.space.lg',
  'iris.space.xl',
  'iris.space.2xl',
  'iris.space.3xl',
  'iris.space.4xl',
  'iris.space.5xl',
  'iris.control.height.sm',
  'iris.control.height.md',
  'iris.control.height.lg',
] as const

export const RADII_TOKENS = ['iris.radius.sm', 'iris.radius.md', 'iris.radius.lg'] as const

export const SHADOW_TOKENS = [
  'iris.shadow.sm',
  'iris.shadow.md',
  'iris.shadow.lg',
  'iris.shadow.xl',
] as const

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
  ColorToken | SpacingToken | RadiusToken | ShadowToken | ZIndexToken | TransitionToken

export const ALL_TOKEN_NAMES: readonly AnyToken[] = [
  ...COLOR_TOKENS,
  ...SPACING_TOKENS,
  ...RADII_TOKENS,
  ...SHADOW_TOKENS,
  ...ZINDEX_TOKENS,
  ...TRANSITION_TOKENS,
]
