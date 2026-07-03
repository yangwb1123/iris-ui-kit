<script lang="ts">
  import { setContext } from 'svelte'
  import { readonly, writable } from 'svelte/store'
  import { applyDirection, applyTheme, injectGlobalStyles } from '@iris-ui/theme'
  // (Direction is inferred from the `dir` prop via ThemeProviderProps.)
  import { toStore } from '../useStore'
  import { THEME_KEY, type IrisThemeContextValue, type ThemeProviderProps } from './context'

  let { store, target = null, dir = 'ltr', cspNonce, children }: ThemeProviderProps = $props()

  // Bridge the framework-agnostic theme store into a Svelte readable, exactly
  // like the React `useSyncExternalStore` / Vue `ref + subscribe` / Solid
  // `useStore` bridges. Zero business logic — `applyTheme` lives in @iris-ui/theme.
  // svelte-ignore state_referenced_locally — `store` is a stable instance, read once.
  const current = toStore(store.store)
  const theme = $derived($current)

  // Mirror the `dir` prop into a store so `useDirection()` consumers stay reactive.
  // svelte-ignore state_referenced_locally — initial value; kept in sync below.
  const dirStore = writable(dir)
  $effect(() => {
    dirStore.set(dir)
  })

  // svelte-ignore state_referenced_locally — `store` is a stable instance.
  setContext<IrisThemeContextValue>(THEME_KEY, {
    store,
    current,
    dir: readonly(dirStore),
  })

  // Apply CSS variables + writing direction to the target; revert on
  // change/unmount via the $effect teardown (mirrors Solid's onCleanup).
  $effect(() => {
    injectGlobalStyles(cspNonce)
    const el = target ?? document.documentElement
    const appliedTheme = applyTheme(theme, el)
    const appliedDir = applyDirection(dir, el)
    return () => {
      appliedTheme.revert()
      appliedDir.revert()
    }
  })
</script>

{@render children?.()}
