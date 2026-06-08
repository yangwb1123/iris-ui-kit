import { getContext, setContext } from 'svelte'

export const TABS_KEY = Symbol('iris-tabs')

export interface TabsContextValue {
  readonly value: string | null
  setValue(next: string): void
  readonly orientation: 'horizontal' | 'vertical'
  readonly disabled: boolean
  readonly lazy: boolean
  registerTrigger(value: string, isDisabled: () => boolean): void
  unregisterTrigger(value: string): void
  moveFocus(from: string, delta: 1 | -1 | 'home' | 'end'): void
  getListEl(): HTMLElement | null
  setListEl(el: HTMLElement | null): void
}

export function setTabsContext(ctx: TabsContextValue) {
  setContext(TABS_KEY, ctx)
}

export function getTabsContext(): TabsContextValue {
  const ctx = getContext<TabsContextValue>(TABS_KEY)
  if (!ctx) throw new Error('[iris-ui] Tabs components must be inside IrisTabs')
  return ctx
}
