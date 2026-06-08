import { getContext, setContext } from 'svelte'

export const DIALOG_KEY = Symbol('iris-ui:dialog')

export interface DialogContextValue {
  readonly open: boolean
  setOpen: (next: boolean) => void
  readonly trigger: HTMLElement | undefined
  setTrigger: (el: HTMLElement | undefined) => void
  readonly content: HTMLElement | undefined
  setContent: (el: HTMLElement | undefined) => void
  contentId: string
  titleId: string
  descriptionId: string
  readonly closeOnOutsideClick: boolean
  readonly closeOnEscape: boolean
}

export function setDialogContext(value: DialogContextValue): void {
  setContext(DIALOG_KEY, value)
}

export function getDialogContext(componentName: string): DialogContextValue {
  const ctx = getContext<DialogContextValue | undefined>(DIALOG_KEY)
  if (!ctx) throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisDialog>`)
  return ctx
}
