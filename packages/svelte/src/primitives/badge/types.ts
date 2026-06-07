import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'

export type IrisBadgeVariant = 'solid' | 'outline' | 'subtle'
export type IrisBadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral'
export type IrisBadgeSize = 'sm' | 'md'

export interface IrisBadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  variant?: IrisBadgeVariant
  tone?: IrisBadgeTone
  size?: IrisBadgeSize
  children?: Snippet
}
