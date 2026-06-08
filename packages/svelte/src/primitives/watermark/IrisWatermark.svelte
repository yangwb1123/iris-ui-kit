<script lang="ts">
  import { mergeStyle } from '../../internal/style'

  const TILE_COUNT = 72

  let {
    content,
    rotate = -22,
    fontSize = 16,
    color = 'var(--iris-muted)',
    opacity = 0.15,
    gap = 24,
    style,
    children,
    ...rest
  } = $props()

  const tiles = $derived(Array.from({ length: TILE_COUNT }, (_, i) => i))
</script>

<div
  {...rest}
  data-iris-watermark
  style={mergeStyle('position: relative', style)}
>
  {@render children?.()}
  <div
    data-iris-watermark-overlay
    aria-hidden="true"
    style="position: absolute; inset: 0; overflow: hidden; pointer-events: none; user-select: none; display: flex; flex-wrap: wrap; align-content: flex-start; gap: {gap}px; opacity: {opacity}"
  >
    {#each tiles as i (i)}
      <span
        data-iris-watermark-tile
        style="transform: rotate({rotate}deg); font-size: {fontSize}px; color: {color}; white-space: nowrap; line-height: 1"
      >
        {content}
      </span>
    {/each}
  </div>
</div>
