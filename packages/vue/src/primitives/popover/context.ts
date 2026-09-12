import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { FloatingMachine, Placement } from '@iris-ui-kit/core'

export interface PopoverContext {
  machine: FloatingMachine
  open: ComputedRef<boolean>
  setOpen: (value: boolean) => void
  triggerRef: Ref<HTMLElement | null>
  contentRef: Ref<HTMLElement | null>
  contentId: string
  placement: Placement
  offset: number
  /** Register teleported descendant surfaces that belong to this popover. */
  registerDismissExclusion: (element: HTMLElement) => () => void
  /** Test whether a pointer target belongs to a registered descendant surface. */
  isDismissExcluded: (target: EventTarget | null) => boolean
}

export const PopoverContextKey: InjectionKey<PopoverContext> = Symbol('IrisPopover')
