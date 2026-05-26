import * as React from 'react'

export interface DialogContextValue {
  open: boolean
  setOpen: (next: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
  contentRef: React.MutableRefObject<HTMLElement | null>
  contentId: string
  titleId: string
  descriptionId: string
  hasTitle: boolean
  hasDescription: boolean
  registerTitle: () => () => void
  registerDescription: () => () => void
  closeOnOutsideClick: boolean
  closeOnEscape: boolean
}

export const DialogContext = React.createContext<DialogContextValue | null>(null)

export function useDialogContext(componentName: string): DialogContextValue {
  const ctx = React.useContext(DialogContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisDialog>`)
  }
  return ctx
}
