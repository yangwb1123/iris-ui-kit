import { defineComponent, h, type PropType, type VNode } from 'vue'
import {
  multiLineGeometry,
  multiBarGeometry,
  donutGeometry,
  chartTooltipLabel,
  type ChartDirection,
  type ChartSeries,
  type ChartSlice,
  type ChartTooltipItem,
  type ChartLegendItem,
  type BarLayout,
} from '../core'

const chartFigureStyle = {
  display: 'inline-flex',
  'flex-direction': 'column',
  gap: 'var(--iris-gap-sm)',
  margin: 0,
}

const chartLegendStyle = {
  display: 'flex',
  'flex-wrap': 'wrap',
  gap: 'var(--iris-gap-sm)',
  margin: 0,
  padding: 0,
  color: 'var(--iris-chart-text)',
  'font-size': 'var(--iris-font-size-sm)',
  'list-style': 'none',
}

function chartLegend(items: readonly ChartLegendItem[], label: string): VNode {
  return h(
    'ul',
    { 'data-iris-chart-legend': '', 'aria-label': label, style: chartLegendStyle },
    items.map((item) =>
      h(
        'li',
        {
          key: item.id,
          style: {
            display: 'inline-flex',
            'align-items': 'center',
            gap: 'var(--iris-gap-sm)',
          },
        },
        [
          h('span', {
            'aria-hidden': 'true',
            style: {
              'inline-size': '0.75em',
              'block-size': '0.75em',
              'border-radius': 'var(--iris-radius-sm)',
              background: item.color,
            },
          }),
          item.label,
        ],
      ),
    ),
  )
}

/** Accessible, token-themed multi-series line chart over shared core geometry. */
export const IrisMultiLineChart = defineComponent({
  name: 'IrisMultiLineChart',
  props: {
    series: { type: Array as PropType<readonly ChartSeries[]>, required: true },
    categories: { type: Array as PropType<readonly string[]>, default: () => [] },
    width: { type: Number, default: 320 },
    height: { type: Number, default: 180 },
    direction: { type: String as PropType<ChartDirection>, default: 'ltr' },
    nice: { type: Boolean, default: true },
    pointRadius: { type: Number, default: 3 },
    ariaLabel: { type: String, default: 'Multi-series line chart' },
    ariaDescription: { type: String, default: undefined },
    legendLabel: { type: String, default: 'Chart legend' },
    showLegend: { type: Boolean, default: true },
  },
  emits: {
    datumFocus: (_item: ChartTooltipItem) => true,
  },
  setup(props, { emit }) {
    return () => {
      const geometry = multiLineGeometry(
        props.series,
        { width: props.width, height: props.height, padding: 12 },
        {
          categories: props.categories,
          direction: props.direction,
          nice: props.nice,
        },
      )
      const children: VNode[] = [
        h('title', props.ariaLabel),
        h('desc', props.ariaDescription ?? geometry.description),
      ]
      for (const item of geometry.series) {
        const seriesChildren: VNode[] = []
        if (item.path) {
          seriesChildren.push(
            h('path', {
              'data-iris-chart-series-line': '',
              d: item.path,
              fill: 'none',
              stroke: item.color,
              'stroke-width': 2,
              'stroke-linejoin': 'round',
              'stroke-linecap': 'round',
              'aria-hidden': 'true',
            }),
          )
        }
        seriesChildren.push(
          ...item.points.map((point) => {
            const label = chartTooltipLabel(point.tooltip)
            return h(
              'circle',
              {
                key: point.id,
                'data-iris-chart-datum': '',
                'data-category-index': point.categoryIndex,
                cx: point.x,
                cy: point.y,
                r: Math.max(1, props.pointRadius),
                fill: point.color,
                stroke: 'var(--iris-chart-point-stroke)',
                'stroke-width': 1,
                role: 'img',
                tabindex: 0,
                'aria-label': label,
                onFocus: () => emit('datumFocus', point.tooltip),
              },
              [h('title', label)],
            )
          }),
        )
        children.push(h('g', { key: item.id, 'data-series-id': item.id }, seriesChildren))
      }

      return h(
        'figure',
        {
          'data-iris-chart-container': 'multi-line',
          dir: props.direction,
          style: chartFigureStyle,
        },
        [
          h(
            'svg',
            {
              'data-iris-chart': 'multi-line',
              role: 'group',
              'aria-label': props.ariaLabel,
              width: props.width,
              height: props.height,
              viewBox: `0 0 ${props.width} ${props.height}`,
            },
            children,
          ),
          props.showLegend ? chartLegend(geometry.legend, props.legendLabel) : null,
        ],
      )
    }
  },
})

/** Accessible stacked/grouped bar chart with signed stacking and shared domain. */
export const IrisStackedBarChart = defineComponent({
  name: 'IrisStackedBarChart',
  props: {
    series: { type: Array as PropType<readonly ChartSeries[]>, required: true },
    categories: { type: Array as PropType<readonly string[]>, default: () => [] },
    width: { type: Number, default: 320 },
    height: { type: Number, default: 180 },
    direction: { type: String as PropType<ChartDirection>, default: 'ltr' },
    layout: { type: String as PropType<BarLayout>, default: 'stacked' },
    nice: { type: Boolean, default: true },
    categoryGap: { type: Number, default: 0.2 },
    seriesGap: { type: Number, default: 0.08 },
    ariaLabel: { type: String, default: 'Stacked bar chart' },
    ariaDescription: { type: String, default: undefined },
    legendLabel: { type: String, default: 'Chart legend' },
    showLegend: { type: Boolean, default: true },
  },
  emits: {
    datumFocus: (_item: ChartTooltipItem) => true,
  },
  setup(props, { emit }) {
    return () => {
      const geometry = multiBarGeometry(
        props.series,
        { width: props.width, height: props.height, padding: 12 },
        {
          categories: props.categories,
          direction: props.direction,
          layout: props.layout,
          nice: props.nice,
          categoryGap: props.categoryGap,
          seriesGap: props.seriesGap,
        },
      )
      return h(
        'figure',
        {
          'data-iris-chart-container': 'stacked-bar',
          dir: props.direction,
          style: chartFigureStyle,
        },
        [
          h(
            'svg',
            {
              'data-iris-chart': 'stacked-bar',
              'data-layout': geometry.layout,
              role: 'group',
              'aria-label': props.ariaLabel,
              width: props.width,
              height: props.height,
              viewBox: `0 0 ${props.width} ${props.height}`,
            },
            [
              h('title', props.ariaLabel),
              h('desc', props.ariaDescription ?? geometry.description),
              ...geometry.rects.map((rect) => {
                const label = chartTooltipLabel(rect.tooltip)
                return h(
                  'rect',
                  {
                    key: `${rect.seriesId}:${rect.categoryIndex}`,
                    'data-iris-chart-datum': '',
                    'data-series-id': rect.seriesId,
                    'data-category-index': rect.categoryIndex,
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height,
                    fill: rect.color,
                    role: 'img',
                    tabindex: 0,
                    'aria-label': label,
                    onFocus: () => emit('datumFocus', rect.tooltip),
                  },
                  [h('title', label)],
                )
              }),
            ],
          ),
          props.showLegend ? chartLegend(geometry.legend, props.legendLabel) : null,
        ],
      )
    }
  },
})

/** Accessible donut (or pie at ratio 0) chart with focusable slice tooltips. */
export const IrisDonutChart = defineComponent({
  name: 'IrisDonutChart',
  props: {
    data: { type: Array as PropType<readonly ChartSlice[]>, required: true },
    width: { type: Number, default: 220 },
    height: { type: Number, default: 220 },
    innerRadiusRatio: { type: Number, default: 0.6 },
    startAngle: { type: Number, default: undefined },
    ariaLabel: { type: String, default: 'Donut chart' },
    ariaDescription: { type: String, default: undefined },
    legendLabel: { type: String, default: 'Chart legend' },
    showLegend: { type: Boolean, default: true },
  },
  emits: {
    datumFocus: (_item: ChartTooltipItem) => true,
  },
  setup(props, { emit }) {
    return () => {
      const geometry = donutGeometry(
        props.data,
        { width: props.width, height: props.height, padding: 8 },
        {
          innerRadiusRatio: props.innerRadiusRatio,
          ...(props.startAngle == null ? {} : { startAngle: props.startAngle }),
        },
      )
      return h('figure', { 'data-iris-chart-container': 'donut', style: chartFigureStyle }, [
        h(
          'svg',
          {
            'data-iris-chart': 'donut',
            role: 'group',
            'aria-label': props.ariaLabel,
            width: props.width,
            height: props.height,
            viewBox: `0 0 ${props.width} ${props.height}`,
          },
          [
            h('title', props.ariaLabel),
            h('desc', props.ariaDescription ?? geometry.description),
            ...geometry.arcs.map((arc) => {
              const label = chartTooltipLabel(arc.tooltip)
              return h(
                'path',
                {
                  key: arc.id,
                  'data-iris-chart-datum': '',
                  'data-slice-id': arc.id,
                  d: arc.path,
                  fill: arc.color,
                  role: 'img',
                  tabindex: 0,
                  'aria-label': label,
                  onFocus: () => emit('datumFocus', arc.tooltip),
                },
                [h('title', label)],
              )
            }),
          ],
        ),
        props.showLegend ? chartLegend(geometry.legend, props.legendLabel) : null,
      ])
    }
  },
})
