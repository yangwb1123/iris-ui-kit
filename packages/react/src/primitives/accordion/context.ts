import * as React from 'react'

export interface AccordionContextValue {
  isOpen: (value: string) => boolean
  toggle: (value: string) => void
  rootId: string
  collapsible: boolean
  multiple: boolean
}

export const AccordionContext = React.createContext<AccordionContextValue | null>(null)

export function useAccordionContext(componentName: string): AccordionContextValue {
  const ctx = React.useContext(AccordionContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be inside an <IrisAccordion>`)
  }
  return ctx
}
