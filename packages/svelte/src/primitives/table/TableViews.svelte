<script lang="ts">
  import {
    TABLE_VIEWS_SAVE_ITEM,
    type TableNamedView,
    type TableViewConfig,
  } from '@iris-ui-kit/core'
  import type { IrisTableViewSnapshot } from './types'

  let {
    config,
    views,
    activeKey,
    onSelect,
    onSave,
    onDelete,
  }: {
    config: TableViewConfig | undefined
    views: Array<TableNamedView<IrisTableViewSnapshot>>
    activeKey: string | null
    onSelect: (key: string) => void
    onSave: (name: string) => void
    onDelete: (key: string) => void
  } = $props()

  let saveOpen = $state(false)
  let draft = $state('')

  function openSave(): void {
    draft = ''
    saveOpen = true
  }
  function confirmSave(): void {
    if (draft.trim()) onSave(draft)
    saveOpen = false
  }
</script>

{#if config}
  <div
    data-iris-table-views-bar
    style="display: flex; align-items: center; gap: var(--iris-space-xxs, 4px); padding: var(--iris-space-xxs, 4px) 0"
  >
    <select
      data-iris-table-views
      value={saveOpen ? TABLE_VIEWS_SAVE_ITEM : (activeKey ?? '')}
      aria-label="Table views"
      onchange={(event) => {
        const value = (event.currentTarget as HTMLSelectElement).value
        if (value === TABLE_VIEWS_SAVE_ITEM) openSave()
        else if (value !== '') onSelect(value)
      }}
      style="border: 1px solid var(--iris-border); border-radius: var(--iris-radius-sm, 4px); background: var(--iris-surface); color: var(--iris-foreground); font: inherit; font-size: var(--iris-font-size-sm, 13px); padding: 0 var(--iris-space-xxs, 4px); max-width: 180px"
    >
      {#if activeKey === null && !saveOpen}<option value="" disabled>Select view</option>{/if}
      {#each views as view}
        <option value={view.name}>{config.label?.(view.name) ?? view.name}</option>
      {/each}
      <option value={TABLE_VIEWS_SAVE_ITEM}>＋ Save view</option>
    </select>
    {#if saveOpen}
      <input
        data-iris-views-save
        type="text"
        bind:value={draft}
        placeholder="View name"
        aria-label="Save view"
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            confirmSave()
          } else if (event.key === 'Escape') {
            saveOpen = false
          }
        }}
        onblur={() => (saveOpen = false)}
        style="border: 1px solid var(--iris-border); border-radius: var(--iris-radius-sm, 4px); padding: var(--iris-space-xxs, 4px); width: 120px; font: inherit"
      />
    {/if}
    {#if activeKey !== null}
      <button
        type="button"
        data-iris-table-views-delete
        aria-label="Delete view"
        onclick={() => onDelete(activeKey!)}
        style="border: none; background: transparent; cursor: pointer; color: var(--iris-muted); font: inherit; padding: 0 var(--iris-space-xxs, 4px)"
        >×</button
      >
    {/if}
  </div>
{/if}
