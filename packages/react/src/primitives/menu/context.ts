import * as React from 'react'
import type { Placement } from '@iris-ui/core'

export interface MenuContextValue {
  open: boolean
  setOpen: (next: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
  contentRef: React.MutableRefObject<HTMLElement | null>
  contentId: string
  placement: Placement
  offset: number
  /** Close the *root* menu — propagates to nested submenus. */
  closeRoot: () => void
}

export const MenuContext = React.createContext<MenuContextValue | null>(null)

export function useMenuContext(componentName: string): MenuContextValue {
  const ctx = React.useContext(MenuContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisMenu>`)
  }
  return ctx
}
