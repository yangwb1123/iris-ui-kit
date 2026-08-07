<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  type ResultStatus = 'success' | 'error' | 'info' | 'warning'

  const STATUS: Record<ResultStatus, { color: string; glyph: string }> = {
    success: { color: 'var(--iris-success, #10b981)', glyph: '✓' },
    error: { color: 'var(--iris-danger)', glyph: '✕' },
    info: { color: 'var(--iris-info, #3b82f6)', glyph: 'i' },
    warning: { color: 'var(--iris-warning, #f59e0b)', glyph: '!' },
  }

  let {
    status = 'info' as ResultStatus,
    title = undefined as string | undefined,
    subtitle = undefined as string | undefined,
    style,
    children,
    icon,
    extra,
    ...rest
  } = $props()

  const s = $derived(STATUS[status as ResultStatus])

  const containerStyle = styleToString({
    display: 'flex',
    'flex-direction': 'column',
    'align-items': 'center',
    'text-align': 'center',
    gap: '8px',
    padding: '32px 16px',
  })
</script>

<div {...rest} data-iris-result data-status={status} style={mergeStyle(containerStyle, style)}>
  <div
    data-iris-result-icon
    aria-hidden="true"
    style="width: 56px; height: 56px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: var(--iris-font-size-4xl, 30px); font-weight: 700; color: var(--iris-primary-foreground, #fff); background: {s.color}; margin-block-end: var(--iris-space-xs, 8px)"
  >
    {#if icon}
      {@render icon()}
    {:else}
      {s.glyph}
    {/if}
  </div>
  {#if title != null}
    <div
      data-iris-result-title
      style="font-size: var(--iris-font-size-2xl, 20px); font-weight: 600; color: var(--iris-foreground)"
    >
      {title}
    </div>
  {/if}
  {#if subtitle != null}
    <div
      data-iris-result-subtitle
      style="font-size: var(--iris-font-size-md, 14px); color: var(--iris-muted); max-width: 480px"
    >
      {subtitle}
    </div>
  {/if}
  {#if children}
    <div data-iris-result-content style="margin-block-start: 8px; width: 100%">
      {@render children()}
    </div>
  {/if}
  {#if extra}
    <div
      data-iris-result-extra
      style="margin-block-start: 8px; display: inline-flex; gap: 8px; flex-wrap: wrap; justify-content: center"
    >
      {@render extra()}
    </div>
  {/if}
</div>
