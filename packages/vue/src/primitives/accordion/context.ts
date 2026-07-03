import type { ComputedRef, InjectionKey, Ref, ShallowRef } from 'vue'

export interface AccordionContext {
  /** True when this item's value is currently open. */
  isOpen: (value: string) => boolean
  toggle: (value: string) => void
  /** Used to wire ARIA + key generation. */
  rootId: string
  /** Allow zero items open at once in single mode. */
  collapsible: ComputedRef<boolean>
  multiple: ComputedRef<boolean>
  /** Current keyboard-navigation active index. */
  activeIndex: Readonly<ShallowRef<number>>
  /**
   * Register a trigger element for keyboard navigation.
   * Returns an unregister function for cleanup.
   */
  registerItem: (value: string, el: Ref<HTMLButtonElement | null>) => () => void
  /** Tell the nav controller to focus the item with the given value. */
  focusItem: (value: string) => void
}

export const AccordionContextKey: InjectionKey<AccordionContext> = Symbol('IrisAccordion')
