<script lang="ts">
  import { useDismiss } from '../../floating/useDismiss.svelte'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { portal } from '../../internal/portal'
  import type {
    IrisTableColumn,
    IrisTableContextMenuConfig,
    IrisTableContextMenuItem,
    IrisTableContextMenuParams,
  } from './types'

  let {
    root,
    config,
    columns,
    getRows,
  }: {
    root: HTMLDivElement | null
    config: IrisTableContextMenuConfig | undefined
    columns: IrisTableColumn[]
    getRows: () => Array<Record<string, unknown>>
  } = $props()

  let menuState = $state<{
    items: IrisTableContextMenuItem[]
    params: IrisTableContextMenuParams
    x: number
    y: number
  } | null>(null)
  let anchorEl = $state<HTMLSpanElement | null>(null)
  let menuEl = $state<HTMLDivElement | null>(null)

  const floating = useFloating({
    anchor: () => anchorEl,
    floating: () => menuEl,
    open: () => menuState !== null,
    placement: 'bottom-start',
    flip: false,
    shift: false,
  })
  useDismiss({
    enabled: () => menuState !== null,
    exclude: [() => anchorEl, () => menuEl],
    onDismiss: () => close(),
  })

  function close(): void {
    menuState = null
  }

  $effect(() => {
    const table = root
    const currentConfig = config
    if (!table || !currentConfig) return
    const onContextMenu = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      const cell = target.closest<HTMLElement>('[data-iris-table-cell]')
      if (!cell || cell.dataset.irisTableCell?.startsWith('__')) return
      const rowEl = cell.closest<HTMLElement>('[data-iris-table-row]')
      const rowIndex = Number(rowEl?.dataset.irisTableRowIndex)
      const columnKey = cell.dataset.irisTableCell
      const column = columns.find((item) => item.key === columnKey)
      const row = Number.isInteger(rowIndex) ? getRows()[rowIndex] : undefined
      if (!rowEl || !column || !row) return
      event.preventDefault()
      event.stopPropagation()
      const params: IrisTableContextMenuParams = {
        row,
        column,
        rowIndex,
        columnIndex: columns.indexOf(column),
      }
      menuState = {
        items: currentConfig.items(params),
        params,
        x: event.clientX,
        y: event.clientY,
      }
    }
    table.addEventListener('contextmenu', onContextMenu)
    return () => table.removeEventListener('contextmenu', onContextMenu)
  })

  $effect(() => {
    if (menuState === null || typeof document === 'undefined') return
    const onScroll = (): void => close()
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  })

  function select(item: IrisTableContextMenuItem): void {
    if (item.disabled || !config || !menuState) return
    config.onSelect(item.key, menuState.params)
    close()
  }
</script>

{#if menuState}
  <span
    bind:this={anchorEl}
    use:portal
    aria-hidden="true"
    style="position: fixed; left: {menuState.x}px; top: {menuState.y}px; width: 1px; height: 1px; pointer-events: none"
  ></span>
  <div
    bind:this={menuEl}
    use:portal
    role="menu"
    data-iris-table-context-menu=""
    style="{floating.floatingStyles}; z-index: var(--iris-z-popover, 1000); background: var(--iris-surface-floating, var(--iris-surface)); color: var(--iris-foreground); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); box-shadow: var(--iris-shadow-lg); padding: var(--iris-space-xxs, 4px); min-width: 160px; display: flex; flex-direction: column"
  >
    {#each menuState.items as item}
      <button
        type="button"
        role="menuitem"
        data-iris-table-context-menu-item={item.key}
        disabled={item.disabled}
        aria-disabled={item.disabled ? 'true' : undefined}
        onclick={() => select(item)}
        style="border: none; background: transparent; cursor: {item.disabled
          ? 'default'
          : 'pointer'}; color: {item.disabled
          ? 'var(--iris-muted)'
          : 'var(--iris-foreground)'}; font: inherit; text-align: start; padding: var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px); border-radius: var(--iris-radius-sm, 4px)"
        >{item.label}</button
      >
    {/each}
  </div>
{/if}
