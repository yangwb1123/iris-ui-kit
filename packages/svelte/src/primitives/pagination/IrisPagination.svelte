<script lang="ts">
  import { getPageRange } from '@iris-ui/core'
  import { useI18n } from '../../i18n'

  type PaginationSize = 'sm' | 'md'

  let {
    value = 1,
    total,
    pageSize = 10,
    siblingCount = 1,
    showFirstLast = false,
    size = 'md',
    disabled = false,
    onchange,
    style,
    ...rest
  }: {
    value?: number
    total: number
    pageSize?: number
    siblingCount?: number
    showFirstLast?: boolean
    size?: PaginationSize
    disabled?: boolean
    onchange?: (page: number) => void
    style?: string
    [key: string]: unknown
  } = $props()

  const { t } = useI18n()

  const totalPages = $derived(Math.max(1, Math.ceil(total / Math.max(1, pageSize))))
  const current = $derived(Math.min(totalPages, Math.max(1, value)))
  const items = $derived(getPageRange(current, totalPages, siblingCount))

  const btnSize = $derived(size === 'sm' ? '28px' : '32px')
  const fontSize = $derived(size === 'sm' ? '12px' : '14px')

  function go(page: number): void {
    if (disabled) return
    const next = Math.min(totalPages, Math.max(1, page))
    if (next === current) return
    onchange?.(next)
  }

  function btnStyle(active: boolean, isDisabled: boolean): string {
    return `display:inline-flex; align-items:center; justify-content:center; min-width:${btnSize}; height:${btnSize}; padding:0 8px; border:1px solid var(--iris-border); border-radius:var(--iris-radius-md,6px); cursor:${isDisabled ? 'not-allowed' : 'pointer'}; opacity:${isDisabled ? '0.5' : '1'}; font-size:${fontSize}; font-family:inherit; line-height:1; ${active ? 'background:var(--iris-primary); color:var(--iris-primary-foreground,#fff); border-color:var(--iris-primary);' : 'background:transparent; color:var(--iris-foreground);'}`
  }
</script>

<nav
  {...rest}
  aria-label={t('pagination.label')}
  data-iris-pagination
  data-iris-pagination-size={size}
  style="display:inline-flex; align-items:center; gap:4px;{style ? ' ' + style : ''}"
>
  {#if showFirstLast}
    <button
      type="button"
      data-iris-pagination-item="first"
      aria-label={t('pagination.first')}
      disabled={disabled || current <= 1 || undefined}
      onclick={() => go(1)}
      style={btnStyle(false, current <= 1)}>«</button
    >
  {/if}
  <button
    type="button"
    data-iris-pagination-item="prev"
    aria-label={t('pagination.previous')}
    disabled={disabled || current <= 1 || undefined}
    onclick={() => go(current - 1)}
    style={btnStyle(false, current <= 1)}>‹</button
  >
  {#each items as item (item)}
    {#if item === 'ellipsis-left' || item === 'ellipsis-right'}
      <span
        data-iris-pagination-ellipsis={item === 'ellipsis-left' ? 'left' : 'right'}
        style="display:inline-flex; align-items:center; justify-content:center; min-width:{btnSize}; height:{btnSize}; color:var(--iris-muted); font-size:{fontSize};"
        >…</span
      >
    {:else}
      <button
        type="button"
        data-iris-pagination-item="page"
        data-iris-pagination-active={item === current ? 'true' : undefined}
        aria-label={t('pagination.page', { page: item as number })}
        aria-current={item === current ? 'page' : undefined}
        disabled={disabled || undefined}
        onclick={() => go(item as number)}
        style={btnStyle(item === current, false)}>{item}</button
      >
    {/if}
  {/each}
  <button
    type="button"
    data-iris-pagination-item="next"
    aria-label={t('pagination.next')}
    disabled={disabled || current >= totalPages || undefined}
    onclick={() => go(current + 1)}
    style={btnStyle(false, current >= totalPages)}>›</button
  >
  {#if showFirstLast}
    <button
      type="button"
      data-iris-pagination-item="last"
      aria-label={t('pagination.last')}
      disabled={disabled || current >= totalPages || undefined}
      onclick={() => go(totalPages)}
      style={btnStyle(false, current >= totalPages)}>»</button
    >
  {/if}
</nav>
