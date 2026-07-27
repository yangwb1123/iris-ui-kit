import { getContext, setContext } from 'svelte'
import type { Placement } from '@iris-ui-kit/core'

export const MENU_KEY = Symbol('iris-ui:menu')

export interface MenuContextValue {
  readonly open: boolean
  setOpen: (next: boolean) => void
  readonly trigger: HTMLElement | undefined
  setTrigger: (el: HTMLElement | undefined) => void
  readonly content: HTMLElement | undefined
  setContent: (el: HTMLElement | undefined) => void
  contentId: string
  readonly placement: Placement
  readonly offset: number
  /**
   * Close the entire menu tree (the ROOT menu). A nested submenu propagates the
   * root's `closeRoot` so selecting any leaf — however deep — collapses
   * everything. At the root this is just `setOpen(false)`.
   */
  closeRoot: () => void
}

export function setMenuContext(value: MenuContextValue): void {
  setContext(MENU_KEY, value)
}

export function getMenuContext(componentName: string): MenuContextValue {
  const ctx = getContext<MenuContextValue | undefined>(MENU_KEY)
  if (!ctx) throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisMenu>`)
  return ctx
}
