import { getContext, setContext } from 'svelte'
import type { Placement } from '@iris-ui/core'

/** Context key for the dropdown — a module-singleton Symbol. */
export const DROPDOWN_KEY = Symbol('iris-ui:dropdown')

/**
 * Shared dropdown state. Reactive values are exposed as getters so descendants
 * (Trigger/Menu/Item) reading `ctx.open` etc. in a reactive scope track the
 * root's `$state`/`$derived` across the component boundary — the Svelte 5
 * equivalent of Solid's accessor-valued context.
 */
export interface DropdownContextValue {
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

export function setDropdownContext(value: DropdownContextValue): void {
  setContext(DROPDOWN_KEY, value)
}

export function getDropdownContext(componentName: string): DropdownContextValue {
  const ctx = getContext<DropdownContextValue | undefined>(DROPDOWN_KEY)
  if (!ctx) throw new Error(`[iris-ui] ${componentName} must be a descendant of <IrisDropdown>`)
  return ctx
}
