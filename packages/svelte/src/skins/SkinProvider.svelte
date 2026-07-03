<script lang="ts">
  import { setContext } from 'svelte'
  import { injectGlobalStyles } from '@iris-ui/theme'
  import { applySkin } from '@iris-ui/skins'
  import { toStore } from '../useStore'
  import { SKIN_KEY, type IrisSkinContextValue, type SkinProviderProps } from './context'

  let { engine, target = null, cspNonce, children }: SkinProviderProps = $props()

  // Mirrors <ThemeProvider>: bridge the engine's store, apply the resolved skin's
  // CSS vars to the target, revert on change/unmount. All skin logic is in
  // @iris-ui/skins — this is just the thin Svelte bridge.
  // svelte-ignore state_referenced_locally — `engine` is a stable instance, read once.
  const current = toStore(engine.store)
  const skin = $derived($current)

  // svelte-ignore state_referenced_locally — `engine` is a stable instance.
  setContext<IrisSkinContextValue>(SKIN_KEY, { engine, current })

  $effect(() => {
    injectGlobalStyles(cspNonce)
    const el = target ?? document.documentElement
    const applied = applySkin(skin, el)
    return () => applied.revert()
  })
</script>

{@render children?.()}
