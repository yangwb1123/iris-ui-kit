<script lang="ts">
  import { createSortable, type SortableState } from '@iris-ui-kit/core'

  export const SORTABLE_ITEM_ATTR = 'data-iris-sortable-item'

  interface Props {
    items: unknown[]
    onReorder?: (items: unknown[]) => void
    getKey?: (item: unknown, index: number) => string
    disabled?: boolean
    orientation?: 'vertical' | 'horizontal'
    containerRole?: 'listbox' | 'presentation'
    itemRole?: 'option' | 'presentation'
    children?: import('svelte').Snippet<[unknown, number]>
  }

  let {
    items,
    onReorder,
    getKey = (_item: unknown, index: number) => String(index),
    disabled = false,
    orientation = 'vertical',
    containerRole = 'listbox',
    itemRole = 'option',
    children,
  }: Props = $props()

  let containerEl: HTMLDivElement | undefined
  let sortableState = $state<SortableState>({ activeId: null, overId: null })
  const ctrl = createSortable()

  $effect(() => {
    const unsub = ctrl.subscribe((s) => {
      sortableState = s
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

  function handleItemKeyDown(event: KeyboardEvent, index: number): void {
    if (disabled) return
    const delta =
      event.key === 'ArrowUp' || event.key === 'ArrowLeft'
        ? -1
        : event.key === 'ArrowDown' || event.key === 'ArrowRight'
          ? 1
          : 0
    if (delta === 0) return
    const target = index + delta
    if (target < 0 || target >= items.length) return
    event.preventDefault()
    const next = [...items]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved!)
    onReorder?.(next)
  }
</script>

<div
  bind:this={containerEl}
  role={containerRole}
  tabindex="-1"
  aria-disabled={disabled ? 'true' : undefined}
  data-iris-sortable
  data-state={sortableState.activeId ? 'dragging' : 'idle'}
  data-disabled={disabled ? '' : undefined}
  style:display="flex"
  style:flex-direction={orientation === 'horizontal' ? 'row' : 'column'}
  style:gap="var(--iris-gap-sm, 4px)"
  style:opacity={disabled ? '0.6' : '1'}
  style:user-select={sortableState.activeId ? 'none' : undefined}
  onpointerdown={handlePointerDown}
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointerleave={handlePointerUp}
>
  {#each items as item, i}
    {@const key = getKey(item, i)}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex — the dynamic option role is keyboard-sortable; presentation mode removes the tab stop. -->
    <div
      role={itemRole}
      aria-selected={itemRole === 'option'
        ? key === sortableState.activeId
          ? 'true'
          : 'false'
        : undefined}
      tabindex={disabled || itemRole === 'presentation' ? -1 : 0}
      data-iris-sortable-item={key}
      data-iris-sortable-dragging={key === sortableState.activeId ? '' : undefined}
      style:transition={key === sortableState.activeId ? 'none' : 'transform 150ms ease'}
      style:opacity={key === sortableState.activeId ? '0.4' : '1'}
      style:position="relative"
      style:z-index={key === sortableState.activeId ? '100' : undefined}
      onkeydown={(event) => handleItemKeyDown(event, i)}
    >
      {#if children}
        {@render children(item, i)}
      {/if}
    </div>
  {/each}
</div>
