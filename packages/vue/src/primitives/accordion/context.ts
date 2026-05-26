import type { ComputedRef, InjectionKey } from 'vue'

export interface AccordionContext {
  /** True when this item's value is currently open. */
  isOpen: (value: string) => boolean
  toggle: (value: string) => void
  /** Used to wire ARIA + key generation. */
  rootId: string
  /** Allow zero items open at once in single mode. */
  collapsible: ComputedRef<boolean>
  multiple: ComputedRef<boolean>
}

export const AccordionContextKey: InjectionKey<AccordionContext> = Symbol('IrisAccordion')
