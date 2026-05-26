import type { ComputedRef, InjectionKey, Ref } from 'vue'

export type IrisToggleGroupType = 'single' | 'multiple'
export type IrisToggleGroupOrientation = 'horizontal' | 'vertical'
export type IrisToggleGroupVariant = 'solid' | 'outline'

export interface ToggleGroupContext {
  type: ComputedRef<IrisToggleGroupType>
  orientation: ComputedRef<IrisToggleGroupOrientation>
  size: ComputedRef<'sm' | 'md' | 'lg'>
  variant: ComputedRef<IrisToggleGroupVariant>
  disabled: ComputedRef<boolean>
  isActive: (value: string) => boolean
  toggle: (value: string) => void
  /** Sequential focus order of registered items, used by arrow-key nav. */
  registerItem: (value: string, el: Ref<HTMLElement | null>) => void
  unregisterItem: (value: string) => void
  moveFocus: (from: string, delta: 1 | -1 | 'home' | 'end') => void
}

export const ToggleGroupContextKey: InjectionKey<ToggleGroupContext> = Symbol('IrisToggleGroup')
