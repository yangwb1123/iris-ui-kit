import { createContext, useContext } from 'solid-js'

export interface AccordionContext {
  isOpen: (value: string) => boolean
  toggle: (value: string) => void
  rootId: string
  collapsible: () => boolean
  multiple: () => boolean
}

export const AccordionCtx = createContext<AccordionContext>()

export function useAccordionContext(): AccordionContext {
  const ctx = useContext(AccordionCtx)
  if (!ctx) throw new Error('IrisAccordionItem must be used inside <IrisAccordion>')
  return ctx
}
