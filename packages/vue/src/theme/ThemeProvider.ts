import {
  computed,
  defineComponent,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch,
  type ComputedRef,
  type InjectionKey,
  type PropType,
  type Ref,
} from 'vue'
import {
  applyDirection,
  applyTheme,
  injectGlobalStyles,
  type ApplyDirectionResult,
  type ApplyThemeResult,
  type Direction,
  type ThemeStore,
} from '@iris-ui/theme'
import type { IrisTheme } from '@iris-ui/tokens'

export interface IrisThemeContext {
  store: ThemeStore
  current: Ref<IrisTheme>
  dir: ComputedRef<Direction>
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
    /** Writing direction; sets `dir` on the target for RTL. Default `'ltr'`. */
    dir: {
      type: String as PropType<Direction>,
      default: 'ltr',
    },
    /** CSP nonce for injected inline stylesheets. */
    cspNonce: {
      type: String,
      default: undefined,
    },
  },
  setup(props, { slots }) {
    const current = ref(props.store.store.getState()) as Ref<IrisTheme>
    const unsubscribe = props.store.store.subscribe((next) => {
      current.value = next
    })

    let applied: ApplyThemeResult | null = null
    let dirApplied: ApplyDirectionResult | null = null

    const targetEl = () => props.target ?? document.documentElement

    const applyCurrent = () => {
      applied?.revert()
      applied = applyTheme(current.value, targetEl())
    }

    const applyDir = () => {
      dirApplied?.revert()
      dirApplied = applyDirection(props.dir, targetEl())
    }

    onMounted(() => {
      injectGlobalStyles(props.cspNonce)
      applyCurrent()
      applyDir()
    })

    watch(current, () => {
      if (applied) applyCurrent()
    })

    watch(
      () => props.dir,
      () => {
        if (dirApplied) applyDir()
      },
    )

    onBeforeUnmount(() => {
      unsubscribe()
      applied?.revert()
      applied = null
      dirApplied?.revert()
      dirApplied = null
    })

    provide(IrisThemeKey, { store: props.store, current, dir: computed(() => props.dir) })

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

/**
 * Current writing direction (`'ltr'` / `'rtl'`) from the nearest
 * `<ThemeProvider>`, or a static `'ltr'` ref when there is none.
 */
export function useDirection(): ComputedRef<Direction> {
  const ctx = inject(IrisThemeKey, null)
  return ctx ? ctx.dir : computed(() => 'ltr' as Direction)
}
