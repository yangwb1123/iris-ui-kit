<script lang="ts">
  import { IrisMovable, IrisResizable } from '@iris-ui/svelte'
  import type { DesktopWindow } from '@iris-ui/core/window'
  import { wm } from './wm.svelte'
  import { getApp } from './apps'

  interface Props {
    window: DesktopWindow
  }

  let { window: w }: Props = $props()

  const app = $derived(getApp(w.appId))
  const rect = $derived(wm.displayRect(w))
  const focused = $derived(wm.isFocused(w.id))
  const maximized = $derived(w.state === 'maximized')

  // Play the open animation on first mount only.
  let firstMount = $state(true)
  $effect(() => {
    firstMount = false
  })

  function focus() {
    wm.focus(w.id)
  }
  function stop(fn: () => void) {
    return (e: Event) => {
      e.stopPropagation()
      fn()
    }
  }
</script>

{#snippet frame()}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="win-frame{firstMount ? ' win-open' : ''}"
    onpointerdown={focus}
    style:display="flex"
    style:flex-direction="column"
    style:width="100%"
    style:height="100%"
    style:border-radius={maximized ? '0' : 'var(--os-window-radius)'}
    style:overflow="hidden"
    style:background="var(--os-window-bg)"
    style:color="var(--os-window-fg)"
    style:border="var(--os-window-border)"
    style:box-shadow={focused ? 'var(--os-window-shadow)' : '0 6px 20px rgba(0,0,0,0.22)'}
    style:backdrop-filter="var(--os-blur)"
    style:-webkit-backdrop-filter="var(--os-blur)"
  >
    <!-- Titlebar -->
    <div
      class="win-titlebar"
      style:display="flex"
      style:align-items="center"
      style:background="var(--os-titlebar-bg)"
      style:border-top-left-radius="inherit"
      style:border-top-right-radius="inherit"
    >
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        data-iris-movable-handle
        ondblclick={() => wm.toggleMaximize(w.id)}
        class="titlebar-grip"
      >
        <span aria-hidden="true" style="font-size:14px">{app?.icon}</span>
        <span class="titlebar-text">{w.title}</span>
      </div>
      <div style="display:flex;align-items:stretch">
        <button
          type="button"
          aria-label="Minimize"
          class="win-ctl"
          onpointerdown={stop(() => wm.minimize(w.id))}>–</button
        >
        <button
          type="button"
          aria-label="Maximize"
          class="win-ctl"
          onpointerdown={stop(() => wm.toggleMaximize(w.id))}>{maximized ? '❒' : '☐'}</button
        >
        <button
          type="button"
          aria-label="Close"
          class="win-ctl win-ctl--close"
          onpointerdown={stop(() => wm.close(w.id))}>✕</button
        >
      </div>
    </div>

    <!-- Body -->
    <div class="win-body" style="flex:1;min-height:0;overflow:auto">
      {#if app}
        {@const Body = app.component}
        <Body />
      {:else}
        <div style="padding:16px">Unknown app: {w.appId}</div>
      {/if}
    </div>
  </div>
{/snippet}

{#if w.state !== 'minimized'}
  {#if maximized}
    <!-- Maximized: pinned to the work area, no drag/resize. -->
    <div
      style:position="absolute"
      style:left="{rect.x}px"
      style:top="{rect.y}px"
      style:width="{rect.width}px"
      style:height="{rect.height}px"
      style:z-index={w.z}
    >
      {@render frame()}
    </div>
  {:else}
    <div style:z-index={w.z} style:position="absolute" style:left="0" style:top="0">
      <IrisMovable
        position={{ x: rect.x, y: rect.y }}
        onPositionChange={(p) => wm.move(w.id, p.x, p.y)}
        byHandle
      >
        <IrisResizable
          size={{ width: rect.width, height: rect.height }}
          onSizeChange={(s) => wm.resize(w.id, s.width, s.height)}
          handles={['right', 'bottom', 'bottom-right']}
          minWidth={w.minSize.width}
          minHeight={w.minSize.height}
        >
          {@render frame()}
        </IrisResizable>
      </IrisMovable>
    </div>
  {/if}
{/if}

<style>
  .titlebar-grip {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    height: var(--os-titlebar-h);
    padding: 0 10px;
    cursor: default;
    user-select: none;
    min-width: 0;
  }
  .titlebar-text {
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
