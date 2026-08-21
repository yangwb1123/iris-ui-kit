<script lang="ts">
  let {
    id,
    active = false,
    over = false,
    onPress,
  }: {
    id: string
    active?: boolean
    over?: boolean
    onPress: (event: PointerEvent) => void
  } = $props()
</script>

<!-- svelte-ignore a11y_interactive_supports_focus -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  role="cell"
  data-iris-table-cell="__drag"
  data-iris-row-drag-handle={id}
  data-iris-row-drag-active={active ? 'true' : undefined}
  data-iris-row-drag-over={over ? 'true' : undefined}
  onpointerdown={onPress}
  onclick={(event) => event.stopPropagation()}
  style="display: flex; align-items: center; justify-content: center; padding: 8px; border-bottom: 1px solid var(--iris-border); cursor: grab; color: var(--iris-muted); background: {active
    ? 'var(--iris-surface-hover)'
    : over
      ? 'var(--iris-surface-selected)'
      : 'transparent'}"
>
  <span aria-hidden="true" style="font-size: var(--iris-font-size-sm, 13px)">⠿</span>
</div>
