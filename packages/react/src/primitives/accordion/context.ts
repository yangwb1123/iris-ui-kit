import * as React from 'react'

export interface AccordionContextValue {
  isOpen: (value: string) => boolean
  toggle: (value: string) => void
  rootId: string
  collapsible: boolean
  multiple: boolean
  /** Current keyboard‑navigation active index. */
  activeIndex: number
  /**
   * Register a trigger element for keyboard navigation.
   * Returns an unregister function for cleanup.
   */
  registerItem: (value: string, el: React.RefObject<HTMLButtonElement | null>) => () => void
  /** Tell the nav controller to focus the item with the given value. */
  focusItem: (value: string) => void
}

export const AccordionContext = React.createContext<AccordionContextValue | null>(null)

export function useAccordionContext(componentName: string): AccordionContextValue {
  const ctx = React.useContext(AccordionContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be inside an <IrisAccordion>`)
  }
  return ctx
}
