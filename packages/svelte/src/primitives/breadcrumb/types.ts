import type { Snippet } from 'svelte'
import type { HTMLAttributes } from 'svelte/elements'

export interface IrisBreadcrumbProps {
  /** Separator between crumbs (CSS content string). Default `/`. */
  separator?: string
  class?: string
  style?: string
  children?: Snippet
}

export interface IrisBreadcrumbItemProps extends HTMLAttributes<HTMLElement> {
  href?: string
  /** Marks this crumb as the current page (plain text + `aria-current="page"`). */
  current?: boolean
}
