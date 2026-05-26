import * as React from 'react'

export type IrisDrawerSide = 'left' | 'right' | 'top' | 'bottom'

export interface DrawerContextValue {
  open: boolean
  setOpen: (next: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
  contentRef: React.MutableRefObject<HTMLElement | null>
  contentId: string
  titleId: string
  side: IrisDrawerSide
  size: string
  hasTitle: boolean
  registerTitle: () => () => void
  closeOnOutsideClick: boolean
  closeOnEscape: boolean
}

export const DrawerContext = React.createContext<DrawerContextValue | null>(null)

export function useDrawerContext(componentName: string): DrawerContextValue {
  const ctx = React.useContext(DrawerContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisDrawer>`)
  }
  return ctx
}
