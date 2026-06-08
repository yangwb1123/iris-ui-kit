import { defineComponent, h, type PropType, type VNode } from 'vue'
import {
  plotBox,
  dataDomain,
  niceDomain,
  seriesPoints,
  linePath,
  areaPath,
  barRects,
  type ChartDimensions,
} from '../core'

/**
 * Vue SVG chart renderers for `@iris-ui/plugin-charts` — render-function
 * authored (matching the `@iris-ui/vue` convention), thin wrappers that consume
 * the framework-agnostic core geometry and draw plain themed SVG. No charting
 * library, no new geometry; the chart inherits the active theme via the
 * `--iris-chart-*` CSS variables registered by the plugin.
 */

/** Line (or area) chart rendered as plain themed SVG over the core geometry. */
export const IrisLineChart = defineComponent({
  name: 'IrisLineChart',
  props: {
    /** The numeric series to plot. */
    data: { type: Array as PropType<number[]>, required: true },
    width: { type: Number, default: 320 },
    height: { type: Number, default: 160 },
    /** Fill the area under the line. Default false. */
    area: { type: Boolean, default: false },
    /** Round the Y domain to nice bounds. Default true. */
    nice: { type: Boolean, default: true },
    /** Accessible description of the chart. */
    ariaLabel: { type: String, default: 'Line chart' },
  },
  setup(props) {
    return () => {
      const dim: ChartDimensions = { width: props.width, height: props.height, padding: 8 }
      const box = plotBox(dim)
      const raw = dataDomain(props.data)
      const domain = props.nice ? niceDomain(raw.min, raw.max) : raw
      const points = seriesPoints(props.data, domain, box)

      const children: VNode[] = []
      if (props.area) {
        children.push(
          h('path', { d: areaPath(points, box), fill: 'var(--iris-chart-area)', stroke: 'none' }),
        )
      }
      children.push(
        h('path', {
          d: linePath(points),
          fill: 'none',
          stroke: 'var(--iris-chart-line)',
          'stroke-width': 2,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
        }),
      )

      return h(
        'svg',
        {
          'data-iris-chart': 'line',
          role: 'img',
          'aria-label': props.ariaLabel,
          width: props.width,
          height: props.height,
          viewBox: `0 0 ${props.width} ${props.height}`,
        },
        children,
      )
    }
  },
})

/** Vertical bar chart rendered as themed SVG over the core geometry. */
export const IrisBarChart = defineComponent({
  name: 'IrisBarChart',
  props: {
    data: { type: Array as PropType<number[]>, required: true },
    width: { type: Number, default: 320 },
    height: { type: Number, default: 160 },
    nice: { type: Boolean, default: true },
    /** Fractional gap between bars (0..1). Default 0.2. */
    gap: { type: Number, default: 0.2 },
    ariaLabel: { type: String, default: 'Bar chart' },
  },
  setup(props) {
    return () => {
      const box = plotBox({ width: props.width, height: props.height, padding: 8 })
      const raw = dataDomain(props.data)
      const domain = props.nice ? niceDomain(Math.min(0, raw.min), raw.max) : raw
      const rects = barRects(props.data, domain, box, props.gap)

      return h(
        'svg',
        {
          'data-iris-chart': 'bar',
          role: 'img',
          'aria-label': props.ariaLabel,
          width: props.width,
          height: props.height,
          viewBox: `0 0 ${props.width} ${props.height}`,
        },
        rects.map((r, i) =>
          h('rect', {
            key: i,
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            fill: 'var(--iris-chart-bar)',
          }),
        ),
      )
    }
  },
})

/** Compact, axis-less inline trend line (for tables / stat cards). */
export const IrisSparkline = defineComponent({
  name: 'IrisSparkline',
  props: {
    data: { type: Array as PropType<number[]>, required: true },
    width: { type: Number, default: 96 },
    height: { type: Number, default: 24 },
    ariaLabel: { type: String, default: 'Sparkline' },
  },
  setup(props) {
    return () => {
      const box = plotBox({ width: props.width, height: props.height, padding: 2 })
      const domain = dataDomain(props.data)
      const points = seriesPoints(props.data, domain, box)

      return h(
        'svg',
        {
          'data-iris-chart': 'sparkline',
          role: 'img',
          'aria-label': props.ariaLabel,
          width: props.width,
          height: props.height,
          viewBox: `0 0 ${props.width} ${props.height}`,
          style: { display: 'inline-block', verticalAlign: 'middle' },
        },
        [
          h('path', {
            d: linePath(points),
            fill: 'none',
            stroke: 'var(--iris-chart-line)',
            'stroke-width': 1.5,
            'stroke-linejoin': 'round',
            'stroke-linecap': 'round',
          }),
        ],
      )
    }
  },
})
