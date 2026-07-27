import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { Placement } from '@iris-ui-kit/core'

export interface DropdownContext {
  open: ComputedRef<boolean>
  setOpen: (value: boolean) => void
  triggerRef: Ref<HTMLElement | null>
  contentRef: Ref<HTMLElement | null>
  contentId: string
  placement: Placement
  offset: number
}

export const DropdownContextKey: InjectionKey<DropdownContext> = Symbol('IrisDropdown')
