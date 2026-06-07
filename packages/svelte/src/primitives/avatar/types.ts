import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'

export type IrisAvatarShape = 'circle' | 'square'
export type IrisAvatarSize = 'sm' | 'md' | 'lg' | number

export interface IrisAvatarProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  src?: string
  alt?: string
  /** Used to derive initials when no `fallback` is supplied. */
  name?: string
  /** Explicit fallback string; wins over derived initials. */
  fallback?: string
  /** Custom fallback content. */
  fallbackContent?: Snippet
  size?: IrisAvatarSize
  shape?: IrisAvatarShape
}
