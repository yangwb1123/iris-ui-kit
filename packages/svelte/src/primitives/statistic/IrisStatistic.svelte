<script lang="ts">
  import { styleToString, mergeStyle } from '../../internal/style'

  type StatisticSize = 'sm' | 'md' | 'lg'
  type StatisticTrend = 'up' | 'down' | 'neutral'

  const VALUE_FONT: Record<StatisticSize, number> = { sm: 20, md: 28, lg: 36 }
  const TREND_COLOR: Record<StatisticTrend, string> = {
    up: 'var(--iris-success, #16a34a)',
    down: 'var(--iris-danger)',
    neutral: 'var(--iris-muted)',
  }
  const TREND_ARROW: Record<StatisticTrend, string> = { up: '▲', down: '▼', neutral: '' }

  let {
    label = undefined as string | number | undefined,
    value = '' as string | number,
    prefix = undefined as string | number | undefined,
    suffix = undefined as string | number | undefined,
    description = undefined as string | number | undefined,
    trend = undefined as StatisticTrend | undefined,
    trendValue = undefined as string | number | undefined,
    size = 'md' as StatisticSize,
    style,
    ...rest
  } = $props()

  const fontSize = $derived(VALUE_FONT[size as StatisticSize] ?? 28)
  const affix = 'font-size: 0.6em; color: var(--iris-muted)'
</script>

<div
  {...rest}
  data-iris-statistic
  data-trend={trend}
  style={mergeStyle(
    styleToString({ display: 'flex', 'flex-direction': 'column', gap: '4px' }),
    style,
  )}
>
  {#if label != null}
    <div data-iris-statistic-label style="font-size: 13px; color: var(--iris-muted)">
      {String(label)}
    </div>
  {/if}
  <div
    data-iris-statistic-value
    style="display: inline-flex; align-items: baseline; gap: 4px; font-size: {fontSize}px; font-weight: 600; color: var(--iris-foreground); font-variant-numeric: tabular-nums"
  >
    {#if prefix != null}
      <span data-iris-statistic-prefix style={affix}>{String(prefix)}</span>
    {/if}
    <span data-iris-statistic-number>{String(value)}</span>
    {#if suffix != null}
      <span data-iris-statistic-suffix style={affix}>{String(suffix)}</span>
    {/if}
  </div>
  {#if trend != null || trendValue != null}
    <div
      data-iris-statistic-trend
      style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px; color: {trend
        ? TREND_COLOR[trend]
        : 'var(--iris-muted)'}"
    >
      {#if trend && TREND_ARROW[trend]}
        <span aria-hidden="true">{TREND_ARROW[trend]}</span>
      {/if}
      {#if trendValue != null}
        <span data-iris-statistic-trend-value>{String(trendValue)}</span>
      {/if}
    </div>
  {/if}
  {#if description != null}
    <div data-iris-statistic-desc style="font-size: 12px; color: var(--iris-muted)">
      {String(description)}
    </div>
  {/if}
</div>
