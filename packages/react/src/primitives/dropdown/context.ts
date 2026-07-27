import * as React from 'react'
import type { Placement } from '@iris-ui-kit/core'

export interface DropdownContextValue {
  open: boolean
  setOpen: (next: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
  contentRef: React.MutableRefObject<HTMLElement | null>
  contentId: string
  placement: Placement
  offset: number
}

export const DropdownContext = React.createContext<DropdownContextValue | null>(null)

export function useDropdownContext(componentName: string): DropdownContextValue {
  const ctx = React.useContext(DropdownContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisDropdown>`)
  }
  return ctx
}
