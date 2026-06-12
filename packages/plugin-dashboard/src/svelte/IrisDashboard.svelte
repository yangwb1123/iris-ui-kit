<script lang="ts">
  import { createDashboard, type DashboardConfig, type DashboardWidget } from '../core'

  let {
    config,
    class: klass = '',
    style = '',
  }: {
    config: DashboardConfig
    class?: string
    style?: string
  } = $props()

  // Create the dashboard store ONCE (props are read at construction only).
  // NB: do not name this `state` — Svelte 5 reads `$state` as a rune.
  // svelte-ignore state_referenced_locally
  const store = createDashboard(config)

  let dashboardState = $state(store.getState())

  $effect(() => store.subscribe((s) => (dashboardState = s)))

  // Track dragged widget id in a plain variable — no reactive overhead.
  let dragWidgetId: string | null = null

  const boardStyle = $derived(
    `display:grid;grid-template-columns:repeat(${dashboardState.columns},1fr);gap:var(--iris-dashboard-gap,16px);position:relative;${style}`,
  )

  function rows(): number {
    return Math.ceil(dashboardState.widgets.length / dashboardState.columns) + 1
  }

  function cellCoords(): Array<[number, number]> {
    const result: Array<[number, number]> = []
    for (let r = 1; r <= rows(); r++) {
      for (let c = 1; c <= dashboardState.columns; c++) {
        result.push([r, c])
      }
    }
    return result
  }
</script>

<div data-iris-dashboard class={klass} style={boardStyle}>
  <!-- Invisible drop cells -->
  {#each cellCoords() as [r, c] (`${r}-${c}`)}
    <div
      data-iris-dashboard-cell={`${c}-${r}`}
      aria-hidden="true"
      style="grid-column:{c}/span 1;grid-row:{r}/span 1;pointer-events:all"
      ondragover={(e) => {
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      }}
      ondrop={(e) => {
        e.preventDefault()
        if (dragWidgetId) {
          store.moveWidget(dragWidgetId, c, r)
        }
        dragWidgetId = null
      }}
    ></div>
  {/each}

  <!-- Widgets -->
  {#each dashboardState.widgets as widget (widget.id)}
    {@const w = widget as DashboardWidget}
    <div
      data-iris-dashboard-widget={w.id}
      style="grid-column:{w.col}/span {w.colSpan};grid-row:{w.row}/span {w.rowSpan};background:var(--iris-dashboard-widget-bg,#fff);border:1px solid var(--iris-color-border,#e5e7eb);border-radius:var(--iris-dashboard-widget-radius,8px);display:flex;flex-direction:column;overflow:hidden;position:relative;z-index:1"
    >
      <!-- Widget header with drag handle -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        data-iris-dashboard-widget-header={w.id}
        role="button"
        tabindex="0"
        draggable="true"
        style="display:flex;align-items:center;gap:6px;padding:8px 12px;cursor:grab;border-bottom:1px solid var(--iris-color-border,#e5e7eb);font-weight:600;user-select:none"
        ondragstart={(e) => {
          dragWidgetId = w.id
          if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
        }}
        ondragend={() => {
          dragWidgetId = null
        }}
      >
        <span
          data-iris-dashboard-drag-handle
          aria-hidden="true"
          style="font-size:1rem;line-height:1;color:var(--iris-color-muted,#9ca3af)"
        >⠿</span>
        <span data-iris-dashboard-widget-title={w.id}>{w.title}</span>
      </div>

      <!-- Widget content area -->
      <div
        data-iris-dashboard-widget-content={w.id}
        style="flex:1;padding:12px"
      ></div>
    </div>
  {/each}
</div>
