import type { Snippet } from 'svelte'
import type { HTMLInputAttributes } from 'svelte/elements'

export type IrisInputSize = 'sm' | 'md' | 'lg'
export type IrisInputType = 'text' | 'password' | 'email' | 'number' | 'search' | 'tel' | 'url'

export interface IrisInputProps extends Omit<
  HTMLInputAttributes,
  'size' | 'type' | 'children' | 'prefix'
> {
  size?: IrisInputSize
  type?: IrisInputType
  invalid?: boolean
  ariaDescribedby?: string
  prefix?: Snippet
  suffix?: Snippet
}
