<script lang="ts">
  import { createSortable, type SortableRect } from '@iris-ui-kit/core'
  import { createKanban, type KanbanConfig, type KanbanColumn } from '../core'

  let {
    config,
    class: klass = '',
    style = '',
  }: {
    config: KanbanConfig
    class?: string
    style?: string
  } = $props()

  // Create the kanban store ONCE (props are read at construction only).
  // NB: do not name this `state` — Svelte 5 reads `$state` as a rune.
  // svelte-ignore state_referenced_locally
  const store = createKanban(config)

  let kanbanState = $state(store.getState())

  $effect(() => store.subscribe((s) => (kanbanState = s)))

  // Touch/pen reorder via the shared core controller. Native HTML5 DnD never
  // fires on touch, so the board would otherwise be unusable under Cordova /
  // touch laptops. The pointer path is gated on `pointerType !== 'mouse'` so
  // the desktop mouse flow — and its tests — are unchanged.
  // NB: do not name this `state` — Svelte 5 reads `$state` as a rune.
  // svelte-ignore state_referenced_locally
  const sortable = createSortable()
  let sortableState = $state(sortable.getState())
  $effect(() => sortable.subscribe((s) => (sortableState = s)))

  // Track dragged card id in a plain variable — no reactive overhead.
  let dragCardId: string | null = null

  // Drop-target rects, measured ONCE when a drag actually starts (not per move).
  // Plain variable: rects do not drive rendering, so no $state needed.
  let dragRects: SortableRect[] = []

  const boardStyle = $derived(
    `display:flex;gap:var(--iris-kanban-gap,var(--iris-space-md,16px));align-items:flex-start;overflow-x:auto;${style}`,
  )

  function atLimit(col: KanbanColumn): boolean {
    return col.limit !== undefined && col.cards.length >= col.limit
  }

  function colCount(col: KanbanColumn): string {
    return col.limit !== undefined ? `${col.cards.length}/${col.limit}` : String(col.cards.length)
  }

  /** Collect drop-target rects (id + client rect) for every `[attr]` under `root`. */
  function collectRects(root: HTMLElement | null, attr: string): SortableRect[] {
    if (!root) return []
    return Array.from(root.querySelectorAll<HTMLElement>(`[${attr}]`)).map((el) => {
      const r = el.getBoundingClientRect()
      return {
        id: el.getAttribute(attr)!,
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      }
    })
  }

  function isAtLimit(colId: string): boolean {
    const col = store.getState().columns.find((c) => c.id === colId)
    return col?.limit !== undefined && col.cards.length >= col.limit
  }

  function onCardPointerDown(cardId: string, e: PointerEvent) {
    if (e.pointerType === 'mouse') return // desktop mouse → native HTML5 DnD
    // setPointerCapture can throw (inactive pointer / jsdom) — best-effort.
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    } catch {
      /* ignore */
    }
    // Record a pending press — no store write, so a tap never re-renders.
    sortable.press(cardId, e.clientX, e.clientY)
  }
  function onCardPointerMove(cardId: string, e: PointerEvent) {
    // Promote the pending press once it moves past the threshold; cache the
    // column rects at that moment (one getBoundingClientRect sweep per drag).
    if (sortable.tryStart(e.clientX, e.clientY)) {
      const root = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-iris-kanban]')
      dragRects = collectRects(root, 'data-iris-kanban-column')
    }
    if (!sortable.isActive(cardId)) return
    sortable.moveOver({ x: e.clientX, y: e.clientY }, dragRects)
  }
  function onCardPointerUp(cardId: string) {
    if (!sortable.isActive(cardId)) {
      sortable.cancel() // clear a pending tap (idle → no re-render)
      return
    }
    const { activeId, overId } = sortable.end()
    if (activeId && overId && !isAtLimit(overId)) store.moveCard(activeId, overId)
  }
  function onCardPointerCancel() {
    sortable.cancel()
  }

  // Live drop highlight (outline) for the touch/pen pointer path.
  function colStyle(col: KanbanColumn, limited: boolean): string {
    const base =
      'width:var(--iris-kanban-col-width,280px);flex-shrink:0;display:flex;flex-direction:column;gap:8px'
    const over =
      sortableState.activeId && sortableState.overId === col.id && !limited
        ? ';outline:2px solid var(--iris-primary,#6366f1);outline-offset:2px'
        : ''
    return base + over
  }
</script>

<div data-iris-kanban class={klass} style={boardStyle}>
  {#each kanbanState.columns as col (col.id)}
    {@const limited = atLimit(col)}
    <div
      data-iris-kanban-column={col.id}
      style={colStyle(col, limited)}
      ondragover={(e) => {
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = limited ? 'none' : 'move'
      }}
      ondrop={(e) => {
        e.preventDefault()
        if (dragCardId && !limited) {
          store.moveCard(dragCardId, col.id)
        }
        dragCardId = null
      }}
    >
      <!-- Column header -->
      <div
        data-iris-kanban-col-header
        style="display:flex;align-items:center;gap:var(--iris-space-xs,8px);font-weight:600"
      >
        <span>{col.title}</span>
        <span data-iris-kanban-count style="font-size:0.8em;color:var(--iris-muted,#64748b)"
          >{colCount(col)}</span
        >
        {#if limited}
          <span
            data-iris-kanban-wip-badge
            style="font-size:0.7em;background:var(--iris-warning,#f59e0b);color:var(--iris-warning-foreground,#451a03);border-radius:4px;padding:var(--iris-space-xxs,4px) var(--iris-padding-sm,6px)"
            >WIP</span
          >
        {/if}
      </div>

      <!-- Cards -->
      {#each col.cards as card (card.id)}
        <div
          data-iris-kanban-card={card.id}
          draggable="true"
          style="background:var(--iris-kanban-card-bg,var(--iris-surface,#f8fafc));border:1px solid var(--iris-border,#e2e8f0);border-radius:6px;padding:var(--iris-space-xs,8px) var(--iris-space-sm,12px);cursor:grab;display:flex;flex-direction:column;gap:4px;touch-action:none"
          ondragstart={(e) => {
            dragCardId = card.id
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
          }}
          ondragend={() => {
            dragCardId = null
          }}
          onpointerdown={(e) => onCardPointerDown(card.id, e)}
          onpointermove={(e) => onCardPointerMove(card.id, e)}
          onpointerup={() => onCardPointerUp(card.id)}
          onpointercancel={() => onCardPointerCancel()}
        >
          <span data-iris-kanban-card-title style="font-weight:500">{card.title}</span>
          {#if card.description}
            <span
              data-iris-kanban-card-desc
              style="font-size:0.85em;color:var(--iris-muted,#64748b)">{card.description}</span
            >
          {/if}
          {#if card.tags && card.tags.length > 0}
            <div data-iris-kanban-card-tags style="display:flex;flex-wrap:wrap;gap:4px">
              {#each card.tags as tag (tag)}
                <span
                  data-iris-kanban-tag
                  style="font-size:0.75em;background:var(--iris-primary-subtle,#eff6ff);color:var(--iris-primary,#6366f1);border-radius:4px;padding:var(--iris-space-xxs,4px) var(--iris-padding-sm,6px)"
                  >{tag}</span
                >
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>
