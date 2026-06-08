import { createContext, useContext, type Accessor } from 'solid-js'

export type IrisDrawerSide = 'left' | 'right' | 'top' | 'bottom'

export interface DrawerContext {
  open: Accessor<boolean>
  setOpen: (value: boolean) => void
  triggerRef: Accessor<HTMLElement | undefined>
  setTriggerRef: (el: HTMLElement) => void
  contentRef: Accessor<HTMLElement | null | undefined>
  setContentRef: (el: HTMLElement | null) => void
  contentId: string
  titleId: string
  side: Accessor<IrisDrawerSide>
  size: Accessor<string>
  hasTitle: Accessor<boolean>
  setHasTitle: (v: boolean) => void
  readonly closeOnOutsideClick: boolean
  readonly closeOnEscape: boolean
}

export const DrawerContext = createContext<DrawerContext | null>(null)

export function useDrawerContext(componentName: string): DrawerContext {
  const ctx = useContext(DrawerContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be used inside <IrisDrawer>`)
  }
  return ctx
}
