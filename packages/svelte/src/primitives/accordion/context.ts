import { getContext, setContext } from 'svelte'

export const ACCORDION_KEY = Symbol('iris-ui:accordion')

export interface AccordionContextValue {
  readonly multiple: boolean
  readonly collapsible: boolean
  readonly rootId: string
  isOpen: (value: string) => boolean
  toggle: (value: string) => void
  /** Current keyboard-navigation active index. */
  readonly activeIndex: number
  /**
   * Register a trigger element for keyboard navigation.
   * Returns an unregister function for cleanup.
   */
  registerItem: (value: string, el: HTMLButtonElement) => () => void
  /** Tell the nav controller to focus the item with the given value. */
  focusItem: (value: string) => void
}

export function setAccordionContext(value: AccordionContextValue): void {
  setContext(ACCORDION_KEY, value)
}

export function getAccordionContext(componentName: string): AccordionContextValue {
  const ctx = getContext<AccordionContextValue | undefined>(ACCORDION_KEY)
  if (!ctx) throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisAccordion>`)
  return ctx
}
