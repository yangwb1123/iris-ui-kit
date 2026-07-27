import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import {
  IrisLineChart,
  IrisBarChart,
  IrisSparkline,
  IrisMultiLineChart,
  IrisStackedBarChart,
  IrisDonutChart,
  type ChartSeries,
  type ChartSlice,
} from './index'

const series: ChartSeries[] = [
  {
    id: 'revenue',
    label: 'Revenue',
    colorToken: '--iris-chart-series-1',
    values: [10, 20],
  },
  {
    id: 'cost',
    label: 'Cost',
    colorToken: '--iris-chart-series-2',
    values: [4, 8],
  },
]
const slices: ChartSlice[] = [
  { id: 'direct', label: 'Direct', colorToken: '--iris-chart-series-1', value: 60 },
  { id: 'search', label: 'Search', colorToken: '--iris-chart-series-2', value: 40 },
]

// The Vue components render a single <svg> root, so `wrapper.element` *is* the
// chart node — match either the root itself or a descendant (`closest`-style).
function chart(el: Element, kind: string): Element | null {
  return el.matches(`[data-iris-chart="${kind}"]`)
    ? el
    : el.querySelector(`[data-iris-chart="${kind}"]`)
}

describe('IrisLineChart (vue)', () => {
  it('renders an SVG with a line path', () => {
    const wrapper = mount(IrisLineChart, { props: { data: [1, 4, 2, 5] } })
    const svg = chart(wrapper.element, 'line')
    expect(svg).toBeTruthy()
    expect(svg?.querySelector('path[stroke="var(--iris-chart-line)"]')).toBeTruthy()
    wrapper.unmount()
  })
  it('adds an area path when area is set', () => {
    const wrapper = mount(IrisLineChart, { props: { data: [1, 2, 3], area: true } })
    expect(wrapper.element.querySelector('path[fill="var(--iris-chart-area)"]')).toBeTruthy()
    wrapper.unmount()
  })
})

describe('IrisBarChart (vue)', () => {
  it('renders one rect per value', () => {
    const wrapper = mount(IrisBarChart, { props: { data: [3, 1, 4] } })
    const svg = chart(wrapper.element, 'bar')
    expect(svg?.querySelectorAll('rect')).toHaveLength(3)
    wrapper.unmount()
  })
})

describe('IrisSparkline (vue)', () => {
  it('renders a compact line with an accessible label', () => {
    const wrapper = mount(IrisSparkline, {
      props: { data: [1, 2, 1, 3], ariaLabel: 'Sales trend' },
    })
    const svg = chart(wrapper.element, 'sparkline')
    expect(svg?.getAttribute('aria-label')).toBe('Sales trend')
    wrapper.unmount()
  })
})

describe('IrisMultiLineChart (vue)', () => {
  it('renders shared series, accessible metadata and emits datum focus', async () => {
    const onDatumFocus = vi.fn()
    const wrapper = mount(IrisMultiLineChart, {
      props: {
        series,
        categories: ['Jan', 'Feb'],
        ariaLabel: 'Revenue and cost',
        onDatumFocus,
      },
    })
    const svg = chart(wrapper.element, 'multi-line')!
    expect(svg.querySelector('title')?.textContent).toBe('Revenue and cost')
    expect(svg.querySelector('desc')?.textContent).toContain('2 series')
    expect(svg.querySelectorAll('[data-iris-chart-series-line]')).toHaveLength(2)
    expect(svg.querySelectorAll('[data-iris-chart-datum]')).toHaveLength(4)
    expect(wrapper.find('[data-iris-chart-legend]').text()).toContain('Revenue')

    await wrapper.find('[data-iris-chart-datum]').trigger('focus')
    expect(onDatumFocus).toHaveBeenCalledWith(
      expect.objectContaining({ seriesId: 'revenue', categoryLabel: 'Jan', value: 10 }),
    )
    wrapper.unmount()
  })
})

describe('IrisStackedBarChart (vue)', () => {
  it('renders stacked bars and emits focus tooltip data', async () => {
    const onDatumFocus = vi.fn()
    const wrapper = mount(IrisStackedBarChart, {
      props: { series, categories: ['Jan', 'Feb'], onDatumFocus },
    })
    const svg = chart(wrapper.element, 'stacked-bar')!
    expect(svg.getAttribute('data-layout')).toBe('stacked')
    expect(svg.querySelectorAll('[data-iris-chart-datum]')).toHaveLength(4)
    await wrapper.find('[data-iris-chart-datum]').trigger('focus')
    expect(onDatumFocus).toHaveBeenCalledWith(
      expect.objectContaining({ seriesId: 'revenue', categoryIndex: 0 }),
    )
    wrapper.unmount()
  })
})

describe('IrisDonutChart (vue)', () => {
  it('renders focusable arcs, native titles and empty-safe data', async () => {
    const onDatumFocus = vi.fn()
    const wrapper = mount(IrisDonutChart, {
      props: {
        data: slices,
        ariaDescription: 'Traffic sources',
        onDatumFocus,
      },
    })
    const svg = chart(wrapper.element, 'donut')!
    expect(svg.querySelector('desc')?.textContent).toBe('Traffic sources')
    expect(svg.querySelectorAll('[data-iris-chart-datum]')).toHaveLength(2)
    expect(svg.querySelector('[data-iris-chart-datum] title')?.textContent).toBe('Direct: 60 (60%)')
    await wrapper.find('[data-iris-chart-datum]').trigger('focus')
    expect(onDatumFocus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'direct', percentage: 0.6 }),
    )
    wrapper.unmount()

    const empty = mount(IrisDonutChart, {
      props: {
        data: [
          {
            id: 'bad',
            label: 'Bad',
            colorToken: '--iris-chart-series-1',
            value: Number.NaN,
          },
        ],
      },
    })
    expect(empty.findAll('[data-iris-chart-datum]')).toHaveLength(0)
    expect(empty.html()).not.toContain('NaN')
    empty.unmount()
  })
})
