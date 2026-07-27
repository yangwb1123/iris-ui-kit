import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { FloatingMachine } from '@iris-ui-kit/core'

export interface DialogContext {
  machine: FloatingMachine
  open: ComputedRef<boolean>
  setOpen: (value: boolean) => void
  triggerRef: Ref<HTMLElement | null>
  contentRef: Ref<HTMLElement | null>
  contentId: string
  titleId: string
  descriptionId: string
  hasTitle: Ref<boolean>
  hasDescription: Ref<boolean>
  /** Close when the user clicks outside the content (on the backdrop). */
  closeOnOutsideClick: boolean
  /** Close when the user presses Escape. */
  closeOnEscape: boolean
}

export const DialogContextKey: InjectionKey<DialogContext> = Symbol('IrisDialog')
