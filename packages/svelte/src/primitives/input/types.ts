import type { Snippet } from 'svelte'
import type { HTMLInputAttributes } from 'svelte/elements'

export type IrisInputSize = 'sm' | 'md' | 'lg'
export type IrisInputType = 'text' | 'password' | 'email' | 'number' | 'search' | 'tel' | 'url'

export interface IrisInputProps extends Omit<
  HTMLInputAttributes,
  'size' | 'type' | 'children' | 'prefix'
> {
  /**
   * Explicit size. Omit to inherit the nearest `<IrisProvider componentSize>`
   * (`md` when there is none).
   */
  size?: IrisInputSize
  type?: IrisInputType
  invalid?: boolean
  ariaDescribedby?: string
  prefix?: Snippet
  suffix?: Snippet
  /** Host box width — any CSS length, or a number of px. */
  width?: string | number
  /** Stretch the host box to its container (`width: 100%`). */
  fullWidth?: boolean
}
