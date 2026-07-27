import type { Snippet } from 'svelte'
import type { HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements'
import type { Placement } from '@iris-ui-kit/core'
import type { IrisSlotChildProps } from '../slot/slot'

export interface IrisDropdownProps {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  placement?: Placement
  offset?: number
  children?: Snippet
}

export interface IrisDropdownTriggerProps extends Omit<HTMLButtonAttributes, 'children'> {
  asChild?: boolean
  children?: Snippet | Snippet<[IrisSlotChildProps]>
}

export interface IrisDropdownMenuProps extends HTMLAttributes<HTMLDivElement> {
  /** Portal target; `false` renders in place. Default `document.body`. */
  portalTarget?: HTMLElement | false
}

export interface IrisDropdownItemProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean
  /** When true, selecting does NOT close the dropdown. */
  keepOpen?: boolean
  /** Emitted on click or Enter/Space. */
  onSelect?: (event: Event) => void
}

export type IrisDropdownSeparatorProps = HTMLAttributes<HTMLDivElement>
