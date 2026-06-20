<script lang="ts">
  /**
   * Window body for `iframe`-kind apps: embeds an external URL inside the managed
   * window. The window's `appId` is resolved to a manifest to read its `url`.
   * Most major sites block iframe embedding (X-Frame-Options / frame-ancestors),
   * so we show a graceful fallback link if the frame can't load.
   */
  import { getManifest } from '../catalog'

  interface Props {
    appId: string
  }

  let { appId }: Props = $props()

  const manifest = $derived(getManifest(appId))
  const url = $derived(manifest?.url ?? '')
</script>

<div class="iframe-app">
  {#if url}
    <iframe
      src={url}
      title={manifest?.name ?? 'Embedded app'}
      class="frame"
      referrerpolicy="no-referrer"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    ></iframe>
    <div class="fallback">
      <span>Some sites block embedding.</span>
      <a href={url} target="_blank" rel="noopener noreferrer">Open in a new tab ↗</a>
    </div>
  {:else}
    <div style="padding:16px">No URL configured for this app.</div>
  {/if}
</div>

<style>
  .iframe-app {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  .frame {
    flex: 1;
    width: 100%;
    border: none;
    background: #fff;
  }
  .fallback {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 12px;
    font-size: 12px;
    background: color-mix(in srgb, var(--os-window-fg) 6%, transparent);
    border-top: 1px solid rgba(127, 127, 127, 0.2);
  }
  .fallback a {
    color: var(--os-accent);
    font-weight: 600;
    text-decoration: none;
  }
</style>
