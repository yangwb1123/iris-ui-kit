import * as React from 'react'
import type { Placement } from '@iris-ui/core'

export interface PopoverContextValue {
  open: boolean
  setOpen: (next: boolean) => void
  triggerRef: React.MutableRefObject<HTMLElement | null>
  contentRef: React.MutableRefObject<HTMLElement | null>
  contentId: string
  placement: Placement
  offset: number
}

export const PopoverContext = React.createContext<PopoverContextValue | null>(null)

export function usePopoverContext(componentName: string): PopoverContextValue {
  const ctx = React.useContext(PopoverContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisPopover>`)
  }
  return ctx
}
