import * as React from 'react'

export type IrisTabsOrientation = 'horizontal' | 'vertical'

export interface TabsContextValue {
  value: string | null
  setValue: (next: string) => void
  orientation: IrisTabsOrientation
  disabled: boolean
  lazy: boolean
  /** Registers a trigger (mount). Returns an unregister function. */
  registerTrigger: (value: string, isDisabled: () => boolean) => () => void
  moveFocus: (from: string, delta: 1 | -1 | 'home' | 'end') => void
  listRef: React.MutableRefObject<HTMLElement | null>
}

export const TabsContext = React.createContext<TabsContextValue | null>(null)

export function useTabsContext(componentName: string): TabsContextValue {
  const ctx = React.useContext(TabsContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be inside an <IrisTabs>`)
  }
  return ctx
}
