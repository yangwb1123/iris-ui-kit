import { createContext, useContext, type Accessor } from 'solid-js'

export interface AccordionContext {
  isOpen: (value: string) => boolean
  toggle: (value: string) => void
  rootId: string
  collapsible: () => boolean
  multiple: () => boolean
  /** Current keyboard-navigation active index. */
  activeIndex: Accessor<number>
  /**
   * Register a trigger element for keyboard navigation.
   * Returns an unregister function for cleanup.
   */
  registerItem: (value: string, el: HTMLButtonElement) => () => void
  /** Tell the nav controller to focus the item with the given value. */
  focusItem: (value: string) => void
}

export const AccordionCtx = createContext<AccordionContext>()

export function useAccordionContext(): AccordionContext {
  const ctx = useContext(AccordionCtx)
  if (!ctx) throw new Error('IrisAccordionItem must be used inside <IrisAccordion>')
  return ctx
}
