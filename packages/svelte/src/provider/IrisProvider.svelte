<script lang="ts">
  import { setContext } from 'svelte'
  import { runPlugins } from '@iris-ui/core'
  import { applyCssVars } from '@iris-ui/theme'
  import ThemeProvider from '../theme/ThemeProvider.svelte'
  import SkinProvider from '../skins/SkinProvider.svelte'
  import IrisI18nProvider from '../i18n/IrisI18nProvider.svelte'
  import {
    PLUGIN_STORE_KEY,
    type IrisProviderProps,
    type PluginStoreContextValue,
  } from './context'

  const { theme, skin, dir, locale, messages, plugins = [], target, children }: IrisProviderProps =
    $props()

  // The system's only logic lives in core — this is a thin bridge. Re-collect
  // when the `plugins` array changes (Svelte's idiom for React's `useMemo`).
  const collected = $derived(runPlugins(plugins))

  // Plugin messages are the BASE; user messages WIN.
  const mergedMessages = $derived({
    ...collected.messages[locale ?? 'en-US'],
    ...(messages ?? {}),
  })
  const installed = $derived(new Set(plugins.map((p) => p.name)))

  // Getter object keeps `stores`/`installed` reactive as `collected` re-derives.
  setContext<PluginStoreContextValue>(PLUGIN_STORE_KEY, {
    get stores() {
      return collected.stores
    },
    get installed() {
      return installed
    },
  })

  // Tokens: an additive layer over the active theme. SSR-guarded; revert on
  // change/unmount via the $effect teardown (mirrors <ThemeProvider>).
  $effect(() => {
    if (typeof document === 'undefined') return
    const el = target ?? document.documentElement
    const applied = applyCssVars(Object.entries(collected.tokens), el)
    return () => applied.revert()
  })

  // Run plugin teardowns when the plugins set is swapped (a new `collected`) or
  // on unmount, so eager stores / subscriptions / timers don't leak. Mirrors the
  // React `useEffect(() => () => collected.teardown(), [collected])`.
  $effect(() => {
    const current = collected
    return () => current.teardown()
  })
</script>

<!-- Order when present: Theme → Skin → I18n → PluginContext (set above) → children. -->
{#snippet i18nLayer()}
  <IrisI18nProvider {locale} messages={mergedMessages}>
    {@render children?.()}
  </IrisI18nProvider>
{/snippet}

{#snippet skinLayer()}
  {#if skin}
    <SkinProvider engine={skin} {target}>
      {@render i18nLayer()}
    </SkinProvider>
  {:else}
    {@render i18nLayer()}
  {/if}
{/snippet}

{#if theme}
  <ThemeProvider store={theme} {target} dir={dir ?? 'ltr'}>
    {@render skinLayer()}
  </ThemeProvider>
{:else}
  {@render skinLayer()}
{/if}
