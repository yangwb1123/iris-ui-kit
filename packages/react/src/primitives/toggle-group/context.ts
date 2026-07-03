import * as React from 'react'

export type IrisToggleGroupType = 'single' | 'multiple'
export type IrisToggleGroupOrientation = 'horizontal' | 'vertical'
export type IrisToggleGroupVariant = 'outline' | 'solid'
export type IrisToggleGroupSize = 'sm' | 'md' | 'lg'

export interface ToggleGroupContextValue {
  type: IrisToggleGroupType
  orientation: IrisToggleGroupOrientation
  size: IrisToggleGroupSize
  variant: IrisToggleGroupVariant
  disabled: boolean
  isActive: (value: string) => boolean
  toggle: (value: string) => void
  registerItem: (value: string, el: { current: HTMLElement | null }) => () => void
  moveFocus: (from: string, delta: 1 | -1 | 'home' | 'end') => void
  focusItem: (value: string) => void
}

export const ToggleGroupContext = React.createContext<ToggleGroupContextValue | null>(null)

export function useToggleGroupContext(componentName: string): ToggleGroupContextValue {
  const ctx = React.useContext(ToggleGroupContext)
  if (!ctx) {
    throw new Error(`[iris-ui] ${componentName} must be inside an <IrisToggleGroup>`)
  }
  return ctx
}
