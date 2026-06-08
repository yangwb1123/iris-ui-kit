import { getContext, setContext } from 'svelte'

export const TOGGLE_GROUP_KEY = Symbol('iris-toggle-group')

export type ToggleGroupType = 'single' | 'multiple'
export type ToggleGroupOrientation = 'horizontal' | 'vertical'
export type ToggleGroupVariant = 'outline' | 'solid' | 'ghost'

export interface ToggleGroupContextValue {
  readonly type: ToggleGroupType
  readonly orientation: ToggleGroupOrientation
  readonly size: 'sm' | 'md' | 'lg'
  readonly variant: ToggleGroupVariant
  readonly disabled: boolean
  isActive(value: string): boolean
  toggle(value: string): void
  registerItem(value: string, getEl: () => HTMLElement | null): void
  unregisterItem(value: string): void
  moveFocus(from: string, delta: 1 | -1 | 'home' | 'end'): void
}

export function setToggleGroupContext(ctx: ToggleGroupContextValue) {
  setContext(TOGGLE_GROUP_KEY, ctx)
}

export function getToggleGroupContext(): ToggleGroupContextValue {
  const ctx = getContext<ToggleGroupContextValue>(TOGGLE_GROUP_KEY)
  if (!ctx) throw new Error('[iris-ui] IrisToggleGroupItem must be inside IrisToggleGroup')
  return ctx
}
