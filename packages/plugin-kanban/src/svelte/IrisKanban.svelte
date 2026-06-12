<script lang="ts">
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

  // Track dragged card id in a plain variable — no reactive overhead.
  let dragCardId: string | null = null

  const boardStyle = $derived(
    `display:flex;gap:var(--iris-kanban-gap, 16px);align-items:flex-start;overflow-x:auto;${style}`,
  )

  function atLimit(col: KanbanColumn): boolean {
    return col.limit !== undefined && col.cards.length >= col.limit
  }

  function colCount(col: KanbanColumn): string {
    return col.limit !== undefined ? `${col.cards.length}/${col.limit}` : String(col.cards.length)
  }
</script>

<div data-iris-kanban class={klass} style={boardStyle}>
  {#each kanbanState.columns as col (col.id)}
    {@const limited = atLimit(col)}
    <div
      data-iris-kanban-column={col.id}
      style="width:var(--iris-kanban-col-width,280px);flex-shrink:0;display:flex;flex-direction:column;gap:8px"
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
        style="display:flex;align-items:center;gap:6px;font-weight:600"
      >
        <span>{col.title}</span>
        <span
          data-iris-kanban-count
          style="font-size:0.8em;color:var(--iris-color-muted,#6b7280)"
        >{colCount(col)}</span>
        {#if limited}
          <span
            data-iris-kanban-wip-badge
            style="font-size:0.7em;background:var(--iris-color-warning,#f59e0b);color:#fff;border-radius:4px;padding:1px 5px"
          >WIP</span>
        {/if}
      </div>

      <!-- Cards -->
      {#each col.cards as card (card.id)}
        <div
          data-iris-kanban-card={card.id}
          draggable="true"
          style="background:var(--iris-kanban-card-bg,#fff);border:1px solid var(--iris-color-border,#e5e7eb);border-radius:6px;padding:8px 10px;cursor:grab;display:flex;flex-direction:column;gap:4px"
          ondragstart={(e) => {
            dragCardId = card.id
            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
          }}
          ondragend={() => {
            dragCardId = null
          }}
        >
          <span data-iris-kanban-card-title style="font-weight:500">{card.title}</span>
          {#if card.description}
            <span
              data-iris-kanban-card-desc
              style="font-size:0.85em;color:var(--iris-color-muted,#6b7280)"
            >{card.description}</span>
          {/if}
          {#if card.tags && card.tags.length > 0}
            <div data-iris-kanban-card-tags style="display:flex;flex-wrap:wrap;gap:4px">
              {#each card.tags as tag (tag)}
                <span
                  data-iris-kanban-tag
                  style="font-size:0.75em;background:var(--iris-color-primary-subtle,#eff6ff);color:var(--iris-color-primary,#2563eb);border-radius:4px;padding:1px 5px"
                >{tag}</span>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/each}
</div>
