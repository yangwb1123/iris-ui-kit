import type { ComputedRef, InjectionKey, Ref } from 'vue'

export type IrisTabsOrientation = 'horizontal' | 'vertical'

export interface TabsContext {
  /** Currently active tab value. */
  value: ComputedRef<string | null>
  /** Switch to the given value. */
  setValue: (value: string) => void
  /** Visual orientation. */
  orientation: ComputedRef<IrisTabsOrientation>
  /** Disabled flag for the whole group. */
  disabled: ComputedRef<boolean>
  /** When true, content panels are unmounted when not active. */
  lazy: ComputedRef<boolean>
  /** Ordered registration of trigger values so arrow keys can navigate them. */
  registerTrigger: (value: string, disabled: () => boolean) => void
  unregisterTrigger: (value: string) => void
  /** Move focus among triggers; called by Trigger key handlers. */
  moveFocus: (from: string, delta: 1 | -1 | 'home' | 'end') => void
  /** Ref to the tablist element (for focus restoration). */
  listRef: Ref<HTMLElement | null>
}

export const TabsContextKey: InjectionKey<TabsContext> = Symbol('IrisTabs')
