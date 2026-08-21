<script lang="ts">
  import { uniqueTableTabs, type TableTab } from '@iris-ui-kit/core'

  let {
    tabs,
    activeKey,
    onApply,
  }: {
    tabs: TableTab[] | undefined
    activeKey: string | null
    onApply: (tab: TableTab) => void
  } = $props()

  const unique = $derived(uniqueTableTabs(tabs ?? []))
</script>

{#if unique.length > 0}
  <div
    role="tablist"
    data-iris-table-tabs
    style="display: flex; align-items: center; gap: var(--iris-space-xs, 8px); padding: var(--iris-space-xs, 8px) var(--iris-space-sm, 12px); border: 1px solid var(--iris-border); border-bottom: none; border-top-left-radius: var(--iris-radius-md, 6px); border-top-right-radius: var(--iris-radius-md, 6px); background: var(--iris-surface)"
  >
    {#each unique as tab (tab.key)}
      <button
        type="button"
        role="tab"
        data-iris-table-tab={tab.key}
        aria-selected={activeKey === tab.key ? 'true' : 'false'}
        onclick={() => onApply(tab)}
        style="border: none; background: transparent; color: {activeKey === tab.key
          ? 'var(--iris-primary)'
          : 'var(--iris-foreground)'}; cursor: pointer; font: inherit; font-weight: {activeKey ===
        tab.key
          ? 600
          : 400}; padding: 0 var(--iris-space-xxs, 4px)">{tab.label}</button
      >
    {/each}
  </div>
{/if}
