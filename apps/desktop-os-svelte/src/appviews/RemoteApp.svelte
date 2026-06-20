<script lang="ts">
  /**
   * Window body for `remote`-kind apps: a micro-frontend ESM module fetched +
   * mounted at RUNTIME. The window's `appId` is resolved to a manifest to read
   * its `url`; we dynamic-import the module (see `../remoteApp.ts`) and hand its
   * `mount` a host DOM node. The returned teardown runs on unmount (or url
   * change). Shows a loading placeholder while importing and an error fallback
   * if the import fails or the module has no `mount`.
   */
  import { getManifest } from '../catalog'
  import { loadRemoteApp } from '../remoteApp'

  interface Props {
    appId: string
  }

  let { appId }: Props = $props()

  const manifest = $derived(getManifest(appId))
  const url = $derived(manifest?.url ?? '')

  let hostEl = $state<HTMLDivElement>()
  let status = $state<'loading' | 'ready' | 'error'>('loading')
  let error = $state('')

  $effect(() => {
    const target = url
    let unmount: (() => void) | void
    let cancelled = false
    status = 'loading'
    error = ''
    if (!target || !hostEl) {
      status = 'error'
      error = 'No URL configured for this app.'
      return
    }
    const host = hostEl
    loadRemoteApp(target)
      .then((mount) => {
        if (cancelled) return
        unmount = mount(host)
        status = 'ready'
      })
      .catch((e: unknown) => {
        if (cancelled) return
        error = e instanceof Error ? e.message : String(e)
        status = 'error'
      })
    return () => {
      cancelled = true
      unmount?.()
    }
  })
</script>

<div class="remote-app">
  <div bind:this={hostEl} class="host"></div>
  {#if status === 'loading'}
    <div class="overlay loading">Loading remote app…</div>
  {:else if status === 'error'}
    <div class="overlay error">
      Couldn’t load remote app{url ? ` from ${url}` : ''}{error ? ` — ${error}` : ''}
    </div>
  {/if}
</div>

<style>
  .remote-app {
    position: relative;
    width: 100%;
    height: 100%;
  }
  .host {
    width: 100%;
    height: 100%;
  }
  .overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 13px;
  }
  .loading {
    opacity: 0.7;
  }
  .error {
    padding: 16px;
    text-align: center;
    color: #ff5f57;
  }
</style>
