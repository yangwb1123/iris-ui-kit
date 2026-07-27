import { createContext, useContext, type Accessor } from 'solid-js'
import type { Placement } from '@iris-ui-kit/core'

export interface PopoverContext {
  open: Accessor<boolean>
  setOpen: (value: boolean) => void
  trigger: Accessor<HTMLElement | undefined>
  setTrigger: (el: HTMLElement) => void
  content: Accessor<HTMLElement | undefined>
  setContent: (el: HTMLElement) => void
  contentId: string
  readonly placement: Placement
  readonly offset: number
}

export const PopoverContext = createContext<PopoverContext | null>(null)

export function usePopoverContext(componentName: string): PopoverContext {
  const ctx = useContext(PopoverContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be used inside <IrisPopover>`)
  }
  return ctx
}
