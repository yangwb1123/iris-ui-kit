import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  provide,
  shallowReactive,
  shallowRef,
  watch,
  type PropType,
  type VNode,
} from 'vue'
import { runPlugins, type CollectedRegistrations, type IrisPlugin } from '@iris-ui-kit/core'
import { applyCssVars, type ApplyCssVarsResult, type ThemeStore } from '@iris-ui-kit/theme'
import type { SkinEngine } from '@iris-ui-kit/skins'
import { ThemeProvider } from '../theme'
import { SkinProvider } from '../skins'
import { IrisI18nProvider } from '../i18n'
import { PluginStoreContextKey, type PluginStoreContext } from './context'

const DEFAULT_LOCALE = 'en-US'

/** Public prop surface of {@link IrisProvider}. */
export interface IrisProviderProps {
  /** Theme store; when present the inner `ThemeProvider` wraps the subtree. */
  theme?: ThemeStore
  /** Skin engine; when present the inner `SkinProvider` wraps the subtree. */
  skin?: SkinEngine
  /** Writing direction, forwarded to `ThemeProvider` when a theme is given. */
  dir?: 'ltr' | 'rtl'
  /** Active BCP-47 locale; defaults to `'en-US'`. */
  locale?: string
  /** User messages — merged OVER plugin-registered messages (user wins). */
  messages?: Record<string, string>
  /** Plugins to install; their tokens / messages / stores are collected once. */
  plugins?: IrisPlugin[]
  /** Element receiving the plugin token layer; defaults to `documentElement`. */
  target?: HTMLElement | null
}

/**
 * The single unified Iris entry point. Runs `plugins` through the core
 * `runPlugins` collector and wires the result into the theme (tokens), i18n
 * (messages) and a plugin-store context, composing the existing per-framework
 * providers. A thin bridge — the real logic lives in `@iris-ui-kit/core`.
 *
 * Render order when present: Theme → Skin → I18n → PluginContext → children.
 */
export const IrisProvider = defineComponent({
  name: 'IrisProvider',
  props: {
    theme: { type: Object as PropType<ThemeStore>, default: undefined },
    skin: { type: Object as PropType<SkinEngine>, default: undefined },
    dir: { type: String as PropType<'ltr' | 'rtl'>, default: undefined },
    locale: { type: String, default: undefined },
    messages: { type: Object as PropType<Record<string, string>>, default: undefined },
    plugins: { type: Array as PropType<IrisPlugin[]>, default: undefined },
    target: { type: Object as PropType<HTMLElement | null>, default: null },
  },
  setup(props, { slots }) {
    // R1: `collected` is reactive so a `plugins` swap re-derives everything
    // downstream (tokens, messages, stores, installed set). Shallow: the stores
    // Map and store instances stay raw — never proxied — so `instanceof` /
    // private fields on class-based stores keep working.
    const collected = shallowRef<CollectedRegistrations>(runPlugins(props.plugins ?? []))

    // R4: one reactive context created once in setup (`provide()` cannot run
    // from a watcher — it requires the setup instance context) and mutated in
    // place on swap so `usePlugin` / `usePluginStore` consumers observe the new
    // stores and installed set after a re-render. Shallow for the same reason.
    const ctx = shallowReactive<PluginStoreContext>({
      stores: collected.value.stores,
      installed: new Set((props.plugins ?? []).map((p) => p.name)),
    })
    provide(PluginStoreContextKey, ctx)

    // tokens → additive CSS-var layer over the active theme; reverted on unmount.
    let applied: ApplyCssVarsResult | null = null
    // Pre-mount swaps must not create a token layer whose revert handle gets
    // shadowed by onMounted — `onMounted` applies the (already current) set.
    let mounted = false
    onMounted(() => {
      mounted = true
      if (typeof document === 'undefined') return
      const el = props.target ?? document.documentElement
      applied = applyCssVars(Object.entries(collected.value.tokens), el)
    })

    // R1–R4: re-collect when the `plugins` prop identity changes (array ref,
    // `Object.is` — same semantics as React `useMemo([plugins])` / Solid
    // `createMemo` / Svelte `$derived`). Non-immediate: the initial collection
    // happens in setup above, so an immediate watch would re-run `runPlugins`
    // (double eager store factories + spurious install→teardown→install).
    // Compute-then-commit: `runPlugins` is the only fallible step; a throwing
    // install aborts before any revert/teardown/replacement is committed.
    watch(
      () => props.plugins,
      (next) => {
        const prev = collected.value
        const nextCollected = runPlugins(next ?? [])
        applied?.revert()
        applied = null
        // R3: the removed set is torn exactly once at the swap (idempotent in
        // core); the current set is still torn exactly once in onBeforeUnmount.
        prev.teardown()
        collected.value = nextCollected
        ctx.stores = nextCollected.stores
        ctx.installed = new Set((next ?? []).map((p) => p.name))
        // R2 + R5: re-apply the new layer (guard `document` for SSR). Pre-mount
        // swaps are applied by onMounted — exactly one layer, no orphaned handle.
        if (mounted && typeof document !== 'undefined') {
          const el = props.target ?? document.documentElement
          applied = applyCssVars(Object.entries(nextCollected.tokens), el)
        }
      },
    )

    onBeforeUnmount(() => {
      applied?.revert()
      applied = null
      // Run plugin teardowns on unmount so eager stores / subscriptions /
      // timers don't leak. Idempotent and safe with no plugins.
      collected.value.teardown()
    })

    return () => {
      const locale = props.locale ?? DEFAULT_LOCALE
      // Plugin messages as BASE, user messages WIN.
      const messages = { ...collected.value.messages[locale], ...(props.messages ?? {}) }

      // I18n always renders, wrapping children.
      let tree: VNode = h(
        IrisI18nProvider,
        { locale: props.locale, messages },
        { default: () => slots.default?.() },
      )
      // Skin wraps only when a `skin` engine is supplied.
      if (props.skin) {
        tree = h(
          SkinProvider,
          { engine: props.skin, target: props.target },
          { default: () => tree },
        )
      }
      // Theme wraps only when a `theme` store is supplied.
      if (props.theme) {
        tree = h(
          ThemeProvider,
          { store: props.theme, target: props.target, dir: props.dir ?? 'ltr' },
          { default: () => tree },
        )
      }
      return tree
    }
  },
})
