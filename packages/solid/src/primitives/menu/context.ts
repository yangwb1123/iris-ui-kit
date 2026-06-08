import { createContext, useContext, type Accessor } from 'solid-js'
import type { Placement } from '@iris-ui/core'

export interface MenuContext {
  open: Accessor<boolean>
  setOpen: (value: boolean) => void
  trigger: Accessor<HTMLElement | undefined>
  setTrigger: (el: HTMLElement) => void
  content: Accessor<HTMLElement | undefined>
  setContent: (el: HTMLElement) => void
  contentId: string
  readonly placement: Placement
  readonly offset: number
  closeRoot: () => void
}

export const MenuContext = createContext<MenuContext | null>(null)

export function useMenuContext(componentName: string): MenuContext {
  const ctx = useContext(MenuContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be used inside <IrisMenu>`)
  }
  return ctx
}
