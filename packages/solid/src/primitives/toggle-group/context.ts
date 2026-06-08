import { createContext } from 'solid-js'

export type IrisToggleGroupType = 'single' | 'multiple'
export type IrisToggleGroupOrientation = 'horizontal' | 'vertical'
export type IrisToggleGroupVariant = 'outline' | 'solid'

export interface ToggleGroupContextValue {
  readonly type: IrisToggleGroupType
  readonly orientation: IrisToggleGroupOrientation
  readonly size: 'sm' | 'md' | 'lg'
  readonly variant: IrisToggleGroupVariant
  readonly disabled: boolean
  isActive: (value: string) => boolean
  toggle: (value: string) => void
  registerItem: (value: string, el: () => HTMLElement | undefined) => void
  unregisterItem: (value: string) => void
  moveFocus: (from: string, delta: 1 | -1 | 'home' | 'end') => void
}

export const ToggleGroupCtx = createContext<ToggleGroupContextValue | undefined>(undefined)
