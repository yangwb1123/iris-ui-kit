import { getContext, setContext } from 'svelte'
import type { Placement } from '@iris-ui/core'

export const POPOVER_KEY = Symbol('iris-ui:popover')

export interface PopoverContextValue {
  readonly open: boolean
  setOpen: (next: boolean) => void
  readonly trigger: HTMLElement | undefined
  setTrigger: (el: HTMLElement | undefined) => void
  readonly content: HTMLElement | undefined
  setContent: (el: HTMLElement | undefined) => void
  contentId: string
  readonly placement: Placement
  readonly offset: number
}

export function setPopoverContext(value: PopoverContextValue): void {
  setContext(POPOVER_KEY, value)
}

export function getPopoverContext(componentName: string): PopoverContextValue {
  const ctx = getContext<PopoverContextValue | undefined>(POPOVER_KEY)
  if (!ctx) throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisPopover>`)
  return ctx
}
