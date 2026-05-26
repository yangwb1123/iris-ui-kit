import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { FloatingMachine, Placement } from '@iris-ui/core'

export interface PopoverContext {
  machine: FloatingMachine
  open: ComputedRef<boolean>
  setOpen: (value: boolean) => void
  triggerRef: Ref<HTMLElement | null>
  contentRef: Ref<HTMLElement | null>
  contentId: string
  placement: Placement
  offset: number
}

export const PopoverContextKey: InjectionKey<PopoverContext> = Symbol('IrisPopover')
