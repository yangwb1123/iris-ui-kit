<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    kind,
    style,
    errorState,
    loadingState,
    emptyState,
    retryable,
    onRetry,
    t,
  }: {
    kind: 'error' | 'loading' | 'empty'
    style: string
    errorState?: Snippet
    loadingState?: Snippet
    emptyState?: Snippet
    retryable: boolean
    onRetry?: () => void
    t: (key: string) => string
  } = $props()
</script>

{#if kind === 'error'}
  <div role="row" data-iris-table-row="error" {style}>
    <span style="margin-inline-end: {retryable ? 'var(--iris-space-sm, 12px)' : '0px'}">
      {#if errorState}{@render errorState()}{:else}{t('table.error')}{/if}
    </span>
    {#if retryable}
      <button
        type="button"
        data-iris-table-retry=""
        onclick={onRetry}
        style="border: 1px solid var(--iris-border); background: var(--iris-surface); color: var(--iris-foreground); border-radius: var(--iris-radius-sm, 4px); padding: var(--iris-space-xxs, 4px) var(--iris-space-xs, 8px); font-size: var(--iris-font-size-sm, 13px); cursor: pointer"
      >
        {t('table.retry')}
      </button>
    {/if}
  </div>
{:else if kind === 'loading'}
  <div role="row" aria-busy="true" data-iris-table-row="loading" {style}>
    {#if loadingState}{@render loadingState()}{:else}{t('table.loading')}{/if}
  </div>
{:else}
  <div role="row" data-iris-table-row="empty" {style}>
    {#if emptyState}{@render emptyState()}{:else}{t('table.empty')}{/if}
  </div>
{/if}
