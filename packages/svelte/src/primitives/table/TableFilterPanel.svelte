<script lang="ts">
  import { useDismiss } from '../../floating/useDismiss.svelte'
  import { useFloating } from '../../floating/useFloating.svelte'
  import { portal } from '../../internal/portal'
  import type { I18n } from '@iris-ui-kit/core'
  import type { IrisTableColumn } from './types'

  type Translate = I18n['t']
  let {
    column,
    values,
    onToggle,
    onApply,
    onClear,
    onClose,
    t,
  }: {
    column: IrisTableColumn
    values: string[]
    onToggle: (value: string) => void
    onApply: () => void
    onClear: () => void
    onClose: () => void
    t: Translate
  } = $props()

  let panelEl = $state<HTMLDivElement | null>(null)
  const anchor = (): HTMLElement | null => {
    if (typeof document === 'undefined') return null
    return (
      [...document.querySelectorAll<HTMLElement>('[data-iris-filter-trigger]')].find(
        (node) => node.dataset.irisFilterTrigger === column.key,
      ) ?? null
    )
  }
  const floating = useFloating({
    anchor,
    floating: () => panelEl,
    open: () => true,
    placement: 'bottom-start',
    offset: 4,
  })
  useDismiss({
    enabled: () => true,
    exclude: [anchor, () => panelEl],
    onDismiss: () => onClose(),
  })
  $effect(() => {
    if (typeof document === 'undefined') return
    const onScroll = (): void => onClose()
    document.addEventListener('scroll', onScroll, true)
    return () => document.removeEventListener('scroll', onScroll, true)
  })
</script>

<div
  bind:this={panelEl}
  use:portal
  role="dialog"
  aria-label={t('table.filter')}
  data-iris-table-filter-panel=""
  data-iris-table-filter-column={column.key}
  style="{floating.floatingStyles}; z-index: var(--iris-z-popover, 1000); background: var(--iris-surface-floating, var(--iris-surface)); color: var(--iris-foreground); border: 1px solid var(--iris-border); border-radius: var(--iris-radius-md, 6px); box-shadow: var(--iris-shadow-lg); padding: var(--iris-space-sm, 12px); min-width: 180px; display: flex; flex-direction: column; gap: var(--iris-space-xxs, 4px)"
>
  {#each column.filterOptions ?? [] as option}
    <label
      data-iris-filter-option={option.value}
      style="display: inline-flex; align-items: center; gap: var(--iris-space-xxs, 4px); cursor: pointer; font-size: var(--iris-font-size-sm, 13px)"
    >
      <input
        type="checkbox"
        checked={values.includes(option.value)}
        onchange={() => onToggle(option.value)}
      />
      {option.label}
    </label>
  {/each}
  <div
    style="display: flex; justify-content: flex-end; gap: var(--iris-space-xs, 8px); margin-top: var(--iris-space-xs, 8px)"
  >
    <button
      type="button"
      data-iris-filter-clear=""
      onclick={onClear}
      style="border: 1px solid var(--iris-border); background: transparent; color: var(--iris-foreground); cursor: pointer; font: inherit; font-size: var(--iris-font-size-sm, 13px); padding: var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px); border-radius: var(--iris-radius-sm, 4px)"
      >{t('table.filterClear')}</button
    >
    <button
      type="button"
      data-iris-filter-confirm=""
      onclick={onApply}
      style="border: 1px solid var(--iris-primary); background: var(--iris-primary); color: var(--iris-primary-foreground); cursor: pointer; font: inherit; font-size: var(--iris-font-size-sm, 13px); padding: var(--iris-space-xxs, 4px) var(--iris-space-sm, 12px); border-radius: var(--iris-radius-sm, 4px)"
      >{t('table.filterConfirm')}</button
    >
  </div>
</div>
