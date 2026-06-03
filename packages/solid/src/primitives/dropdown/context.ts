import { createContext, useContext, type Accessor } from 'solid-js'
import type { Placement } from '@iris-ui/core'

export interface DropdownContextValue {
  open: Accessor<boolean>
  setOpen: (next: boolean) => void
  trigger: Accessor<HTMLElement | undefined>
  setTrigger: (el: HTMLElement | undefined) => void
  content: Accessor<HTMLElement | undefined>
  setContent: (el: HTMLElement | undefined) => void
  contentId: string
  placement: Placement
  offset: number
}

export const DropdownContext = createContext<DropdownContextValue>()

export function useDropdownContext(componentName: string): DropdownContextValue {
  const ctx = useContext(DropdownContext)
  if (!ctx) throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisDropdown>`)
  return ctx
}
