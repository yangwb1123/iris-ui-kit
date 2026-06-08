import { createContext } from 'solid-js'

export type IrisTabsOrientation = 'horizontal' | 'vertical'

export interface TabsContextValue {
  readonly value: string | null
  readonly orientation: IrisTabsOrientation
  readonly disabled: boolean
  readonly lazy: boolean
  setValue: (v: string) => void
  registerTrigger: (value: string, isDisabled: () => boolean) => void
  unregisterTrigger: (value: string) => void
  moveFocus: (from: string, delta: 1 | -1 | 'home' | 'end') => void
  listRef: HTMLElement | undefined
  setListRef: (el: HTMLElement | undefined) => void
}

export const TabsCtx = createContext<TabsContextValue | undefined>(undefined)
