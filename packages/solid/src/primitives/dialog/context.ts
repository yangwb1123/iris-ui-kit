import { createContext, useContext, type Accessor } from 'solid-js'

export interface DialogContext {
  open: Accessor<boolean>
  setOpen: (value: boolean) => void
  triggerRef: Accessor<HTMLElement | undefined>
  setTriggerRef: (el: HTMLElement) => void
  contentRef: Accessor<HTMLElement | null | undefined>
  setContentRef: (el: HTMLElement | null) => void
  contentId: string
  titleId: string
  descriptionId: string
  hasTitle: Accessor<boolean>
  setHasTitle: (v: boolean) => void
  hasDescription: Accessor<boolean>
  setHasDescription: (v: boolean) => void
  readonly closeOnOutsideClick: boolean
  readonly closeOnEscape: boolean
}

export const DialogContext = createContext<DialogContext | null>(null)

export function useDialogContext(componentName: string): DialogContext {
  const ctx = useContext(DialogContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be used inside <IrisDialog>`)
  }
  return ctx
}
