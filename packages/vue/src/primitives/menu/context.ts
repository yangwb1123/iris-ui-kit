import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { Placement } from '@iris-ui-kit/core'

export interface MenuContext {
  open: ComputedRef<boolean>
  setOpen: (value: boolean) => void
  triggerRef: Ref<HTMLElement | null>
  contentRef: Ref<HTMLElement | null>
  contentId: string
  placement: Placement
  offset: number
  /** The root menu's "close everything" call — propagates to submenus. */
  closeRoot: () => void
}

export const MenuContextKey: InjectionKey<MenuContext> = Symbol('IrisMenu')
