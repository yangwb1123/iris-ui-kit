import {
  defineComponent,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch,
  type InjectionKey,
  type PropType,
  type Ref,
} from 'vue'
import { applyTheme, type ApplyThemeResult, type ThemeStore } from '@iris-ui/theme'
import type { IrisTheme } from '@iris-ui/tokens'

export interface IrisThemeContext {
  store: ThemeStore
  current: Ref<IrisTheme>
}

export const IrisThemeKey: InjectionKey<IrisThemeContext> = Symbol('IrisTheme')

/**
 * Renderless provider that:
 * 1. exposes the theme store to descendants via `provide`,
 * 2. applies the current theme to a target element on mount and on change,
 * 3. reverts the inline custom properties on unmount.
 *
 * `target` defaults to `document.documentElement`. Pass an element ref to
 * scope a theme to a subtree.
 */
export const ThemeProvider = defineComponent({
  name: 'IrisThemeProvider',
  props: {
    store: {
      type: Object as PropType<ThemeStore>,
      required: true,
    },
    target: {
      type: Object as PropType<HTMLElement | null>,
      default: null,
    },
  },
  setup(props, { slots }) {
    const current = ref(props.store.store.getState()) as Ref<IrisTheme>
    const unsubscribe = props.store.store.subscribe((next) => {
      current.value = next
    })

    let applied: ApplyThemeResult | null = null

    const applyCurrent = () => {
      applied?.revert()
      const el = props.target ?? document.documentElement
      applied = applyTheme(current.value, el)
    }

    onMounted(() => {
      applyCurrent()
    })

    watch(current, () => {
      if (applied) applyCurrent()
    })

    onBeforeUnmount(() => {
      unsubscribe()
      applied?.revert()
      applied = null
    })

    provide(IrisThemeKey, { store: props.store, current })

    return () => slots.default?.()
  },
})

export function useThemeContext(): IrisThemeContext {
  const ctx = inject(IrisThemeKey)
  if (!ctx) {
    throw new Error('[iris-ui] useTheme(): no <ThemeProvider> ancestor found')
  }
  return ctx
}
