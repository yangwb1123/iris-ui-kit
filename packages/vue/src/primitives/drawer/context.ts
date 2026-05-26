import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { FloatingMachine } from '@iris-ui/core'

export type IrisDrawerSide = 'left' | 'right' | 'top' | 'bottom'

export interface DrawerContext {
  machine: FloatingMachine
  open: ComputedRef<boolean>
  setOpen: (value: boolean) => void
  triggerRef: Ref<HTMLElement | null>
  contentRef: Ref<HTMLElement | null>
  contentId: string
  titleId: string
  side: ComputedRef<IrisDrawerSide>
  size: ComputedRef<string>
  closeOnOutsideClick: boolean
  closeOnEscape: boolean
  hasTitle: Ref<boolean>
}

export const DrawerContextKey: InjectionKey<DrawerContext> = Symbol('IrisDrawer')
