<script lang="ts">
  import { useDrag } from '../drag/useDrag.svelte'

  let {
    colKey,
    label,
    resolvePinnedCount,
    commitPinnedCount,
  }: {
    colKey: string
    label: string
    resolvePinnedCount: (dx: number) => number
    commitPinnedCount: (count: number) => void
  } = $props()

  let handle: HTMLElement | null = $state(null)
  let dragDx = $state(0)

  useDrag({
    handle: () => handle,
    onStart: () => {
      dragDx = 0
    },
    onDrag: ({ dx }) => {
      dragDx = dx
    },
    onEnd: ({ dx }) => {
      commitPinnedCount(resolvePinnedCount(dx))
      dragDx = 0
    },
  })

  function onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    event.stopPropagation()
    commitPinnedCount(resolvePinnedCount(0) + (event.key === 'ArrowRight' ? 1 : -1))
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<span
  bind:this={handle}
  role="separator"
  aria-orientation="vertical"
  aria-label={`Adjust pinned column count at ${label}`}
  tabindex="0"
  data-iris-pinned-drag-handle=""
  data-column-key={colKey}
  data-iris-pinned-drag-active={dragDx !== 0 ? 'true' : undefined}
  onpointerdown={(event) => event.stopPropagation()}
  onkeydown={onKeydown}
  style="position: absolute; top: 0; right: 0; bottom: 0; width: 8px; cursor: col-resize; touch-action: none; user-select: none; z-index: 2; transform: {dragDx !==
  0
    ? `translateX(${dragDx}px)`
    : 'none'}"
>
  <span
    aria-hidden="true"
    data-iris-pinned-drag-line=""
    style="position: absolute; top: 0; bottom: 0; inset-inline-start: 50%; width: 2px; background: var(--iris-primary); transform: translateX(-50%)"
  ></span>
</span>
