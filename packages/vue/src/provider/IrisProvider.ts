import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  provide,
  type PropType,
  type VNode,
} from 'vue'
import { runPlugins, type IrisPlugin } from '@iris-ui/core'
import { applyCssVars, type ApplyCssVarsResult, type ThemeStore } from '@iris-ui/theme'
import type { SkinEngine } from '@iris-ui/skins'
import { ThemeProvider } from '../theme'
import { SkinProvider } from '../skins'
import { IrisI18nProvider } from '../i18n'
import { PluginStoreContextKey } from './context'

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
 * providers. A thin bridge — the real logic lives in `@iris-ui/core`.
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
    // Sync, pure, deterministic — computed once per setup over `plugins`.
    const collected = runPlugins(props.plugins ?? [])

    // tokens → additive CSS-var layer over the active theme; reverted on unmount.
    let applied: ApplyCssVarsResult | null = null
    onMounted(() => {
      if (typeof document === 'undefined') return
      const el = props.target ?? document.documentElement
      applied = applyCssVars(Object.entries(collected.tokens), el)
    })
    onBeforeUnmount(() => {
      applied?.revert()
      applied = null
    })

    // stores + installed names → PluginStoreContext.
    provide(PluginStoreContextKey, {
      stores: collected.stores,
      installed: new Set((props.plugins ?? []).map((p) => p.name)),
    })

    return () => {
      const locale = props.locale ?? DEFAULT_LOCALE
      // Plugin messages as BASE, user messages WIN.
      const messages = { ...collected.messages[locale], ...(props.messages ?? {}) }

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
