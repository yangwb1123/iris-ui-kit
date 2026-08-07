import { createPlugin } from '@iris-ui-kit/core'

/** CSS custom properties the charts read; overridable by the host theme. */
export const chartTokens: Record<string, string> = {
  '--iris-chart-line': 'var(--iris-primary)',
  '--iris-chart-area': 'var(--iris-primary-subtle)',
  '--iris-chart-bar': 'var(--iris-primary)',
  '--iris-chart-series-1': 'var(--iris-primary)',
  '--iris-chart-series-2': 'var(--iris-accent)',
  '--iris-chart-series-3': 'var(--iris-success)',
  '--iris-chart-series-4': 'var(--iris-warning)',
  '--iris-chart-series-5': 'var(--iris-danger)',
  '--iris-chart-series-6': 'var(--iris-info)',
  '--iris-chart-point-stroke': 'var(--iris-background)',
  '--iris-chart-text': 'var(--iris-muted)',
}

/** Token registration for `IrisProvider`. */
export const chartsPlugin = createPlugin({
  name: 'charts',
  install(registry) {
    registry.registerTokens(chartTokens)
  },
})
