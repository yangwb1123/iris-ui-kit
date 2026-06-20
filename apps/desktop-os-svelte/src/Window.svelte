<script lang="ts">
  import { IrisMovable, IrisResizable } from '@iris-ui/svelte'
  import type { DesktopWindow, SnapZone } from '@iris-ui/core/window'
  import { wm, useWmState } from './wm.svelte'
  import { useOs } from './os-state.svelte'
  import { getManifest } from './catalog'
  import { snapHintFor } from './depth'
  import IframeApp from './appviews/IframeApp.svelte'
  import RemoteApp from './appviews/RemoteApp.svelte'

  interface Props {
    window: DesktopWindow
    /**
     * Report the live drag-to-edge snap zone (or `null` to clear) so the Desktop
     * can render the snap preview. Omitted in non-snapping contexts (e.g. tests).
     */
    onSnapHint?: (zone: SnapZone | null) => void
  }

  let { window: w, onSnapHint }: Props = $props()

  // The live OS skin drives where the window controls sit + their style: macOS
  // traffic-lights on the LEFT (`controls === 'left'`), vs. Windows glyph buttons
  // or KDE round controls on the right. Mirrors React's `Window.tsx` Controls/
  // Chrome split.
  const osCtx = useOs()
  const chrome = $derived(osCtx.chrome)

  const app = $derived(getManifest(w.appId))
  const rect = $derived(wm.displayRect(w))
  const focused = $derived(wm.isFocused(w.id))
  const maximized = $derived(w.state === 'maximized')

  // Live work area drives the drag-to-edge snap detection.
  const wmState = useWmState()
  const workArea = $derived(wmState.value.workArea)
  // The snap zone hinted by the IN-FLIGHT drag (mirrored to Desktop via onSnapHint).
  let dragZone: SnapZone | null = null

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

{#snippet title()}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div data-iris-movable-handle ondblclick={() => wm.toggleMaximize(w.id)} class="titlebar-grip">
    <span aria-hidden="true" style="font-size:14px">{app?.icon}</span>
    <span class="titlebar-text">{w.title}</span>
  </div>
{/snippet}

{#snippet controls()}
  {#if chrome.controlStyle === 'mac'}
    <!-- macOS traffic-lights: close / minimize / maximize on the left. -->
    <div class="mac-ctls">
      <button
        type="button"
        aria-label="Close"
        class="mac-dot mac-dot--close"
        onpointerdown={stop(() => wm.close(w.id))}
      ></button>
      <button
        type="button"
        aria-label="Minimize"
        class="mac-dot mac-dot--min"
        onpointerdown={stop(() => wm.minimize(w.id))}
      ></button>
      <button
        type="button"
        aria-label="Maximize"
        class="mac-dot mac-dot--max"
        onpointerdown={stop(() => wm.toggleMaximize(w.id))}
      ></button>
    </div>
  {:else if chrome.controlStyle === 'kde'}
    <!-- KDE Plasma: round flat controls on the right; close hovers accent-red. -->
    <div class="kde-ctls">
      <button
        type="button"
        aria-label="Minimize"
        class="kde-ctl"
        onpointerdown={stop(() => wm.minimize(w.id))}>–</button
      >
      <button
        type="button"
        aria-label="Maximize"
        class="kde-ctl"
        onpointerdown={stop(() => wm.toggleMaximize(w.id))}>{maximized ? '❐' : '☐'}</button
      >
      <button
        type="button"
        aria-label="Close"
        class="kde-ctl kde-ctl--close"
        onpointerdown={stop(() => wm.close(w.id))}>✕</button
      >
    </div>
  {:else}
    <!-- Windows glyph buttons on the right; close hovers red. -->
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
  {/if}
{/snippet}

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
      {#if chrome.controls === 'left'}
        <div class="mac-ctl-wrap">{@render controls()}</div>
        {@render title()}
      {:else}
        {@render title()}
        {@render controls()}
      {/if}
    </div>

    <!-- Body -->
    <div class="win-body" style="flex:1;min-height:0;overflow:auto">
      {#if app?.kind === 'component' && app.component}
        {@const Body = app.component}
        <Body />
      {:else if app?.kind === 'iframe'}
        <IframeApp appId={w.appId} />
      {:else if app?.kind === 'remote'}
        <RemoteApp appId={w.appId} />
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
        onPositionChange={(p) => {
          wm.move(w.id, p.x, p.y)
          // Detect a snap zone from the top-left and surface it to Desktop.
          const zone = snapHintFor(p, workArea)
          if (zone !== dragZone) {
            dragZone = zone
            onSnapHint?.(zone)
          }
        }}
        onDragEnd={() => {
          const zone = dragZone
          dragZone = null
          onSnapHint?.(null)
          if (zone) wm.snap(w.id, zone)
        }}
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

  /* macOS traffic-light window controls (left of the titlebar). */
  .mac-ctl-wrap {
    padding: 0 10px;
  }
  .mac-ctls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .mac-dot {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .mac-dot--close {
    background: #ff5f57;
  }
  .mac-dot--min {
    background: #febc2e;
  }
  .mac-dot--max {
    background: #28c840;
  }

  /* KDE Plasma window controls (round flat buttons, right of the titlebar). */
  .kde-ctls {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
  }
  .kde-ctl {
    width: 22px;
    height: 22px;
    border: none;
    border-radius: 50%;
    background: rgba(127, 127, 127, 0.16);
    color: inherit;
    font-size: 12px;
    line-height: 1;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition:
      background 0.12s ease,
      color 0.12s ease;
  }
  .kde-ctl:hover {
    background: var(--os-accent);
    color: #fff;
  }
  .kde-ctl--close:hover {
    background: #da4453;
    color: #fff;
  }
</style>
