<script lang="ts">
  import { createSortable, type SortableState } from '@iris-ui-kit/core'

  export const SORTABLE_ITEM_ATTR = 'data-iris-sortable-item'

  interface Props {
    items: unknown[]
    onReorder?: (items: unknown[]) => void
    getKey?: (item: unknown, index: number) => string
    disabled?: boolean
    children?: import('svelte').Snippet
  }

  let {
    items,
    onReorder,
    getKey = (_item: unknown, index: number) => String(index),
    disabled = false,
    children,
  }: Props = $props()

  let containerEl: HTMLDivElement | undefined
  let state = $state<SortableState>({ activeId: null, overId: null })
  const ctrl = createSortable()

  $effect(() => {
    const unsub = ctrl.subscribe((s) => {
      state = s
    })
    return unsub
  })

  function indexByKey(key: string): number {
    if (!containerEl) return -1
    return Array.from(containerEl.querySelectorAll(`[${SORTABLE_ITEM_ATTR}]`)).findIndex(
      (el) => el.getAttribute(SORTABLE_ITEM_ATTR) === key,
    )
  }

  function handlePointerDown(e: PointerEvent) {
    if (disabled) return
    const target = (e.target as HTMLElement).closest(
      `[${SORTABLE_ITEM_ATTR}]`,
    ) as HTMLElement | null
    if (!target) return
    const key = target.getAttribute(SORTABLE_ITEM_ATTR) ?? ''
    if (!key) return
    ctrl.press(key, e.clientX, e.clientY)
  }

  function handlePointerMove(e: PointerEvent) {
    if (!ctrl.getState().activeId) {
      if (!ctrl.tryStart(e.clientX, e.clientY)) return
    }
    if (!containerEl) return
    const items = containerEl.querySelectorAll<HTMLElement>(`[${SORTABLE_ITEM_ATTR}]`)
    const rects = Array.from(items).map((el) => ({
      id: el.getAttribute(SORTABLE_ITEM_ATTR) ?? '',
      left: el.offsetLeft,
      top: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    }))
    ctrl.moveOver({ x: e.clientX, y: e.clientY }, rects)
  }

  function handlePointerUp() {
    const result = ctrl.end()
    if (result.activeId && result.overId && result.activeId !== result.overId) {
      const from = indexByKey(result.activeId)
      const to = indexByKey(result.overId)
      if (from >= 0 && to >= 0 && from !== to) {
        const next = [...items]
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved!)
        onReorder?.(next)
      }
    }
  }
</script>

<div
  bind:this={containerEl}
  data-iris-sortable
  data-state={state.activeId ? 'dragging' : 'idle'}
  data-disabled={disabled ? '' : undefined}
  style:display="flex"
  style:flex-direction="column"
  style:gap="var(--iris-gap-sm, 4px)"
  style:opacity={disabled ? '0.6' : '1'}
  style:user-select={state.activeId ? 'none' : undefined}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointerleave={handlePointerUp}
>
  {#each items as item, i}
    {@const key = getKey(item, i)}
    <div
      data-iris-sortable-item={key}
      data-iris-sortable-dragging={key === state.activeId ? '' : undefined}
      style:transition={key === state.activeId ? 'none' : 'transform 150ms ease'}
      style:opacity={key === state.activeId ? '0.4' : '1'}
      style:position="relative"
      style:z-index={key === state.activeId ? '100' : undefined}
    >
      {#if children}
        {@render children()}
      {/if}
    </div>
  {/each}
</div>
