import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
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

afterEach(cleanup)

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

describe('IrisLineChart (react)', () => {
  it('renders an SVG with a line path', () => {
    const { container } = render(<IrisLineChart data={[1, 4, 2, 5]} />)
    const svg = container.querySelector('[data-iris-chart="line"]')
    expect(svg).toBeTruthy()
    expect(svg?.querySelector('path[stroke="var(--iris-chart-line)"]')).toBeTruthy()
  })
  it('adds an area path when area is set', () => {
    const { container } = render(<IrisLineChart data={[1, 2, 3]} area />)
    expect(container.querySelector('path[fill="var(--iris-chart-area)"]')).toBeTruthy()
  })
})

describe('IrisBarChart (react)', () => {
  it('renders one rect per value', () => {
    const { container } = render(<IrisBarChart data={[3, 1, 4]} />)
    expect(container.querySelectorAll('[data-iris-chart="bar"] rect')).toHaveLength(3)
  })
})

describe('IrisSparkline (react)', () => {
  it('renders a compact line with an accessible label', () => {
    const { container } = render(<IrisSparkline data={[1, 2, 1, 3]} ariaLabel="Sales trend" />)
    const svg = container.querySelector('[data-iris-chart="sparkline"]')
    expect(svg?.getAttribute('aria-label')).toBe('Sales trend')
  })
})

describe('IrisMultiLineChart (react)', () => {
  it('renders shared series, title/desc, legend and focusable tooltip data', () => {
    const onDatumFocus = vi.fn()
    const { container } = render(
      <IrisMultiLineChart
        series={series}
        categories={['Jan', 'Feb']}
        ariaLabel="Revenue and cost"
        onDatumFocus={onDatumFocus}
      />,
    )
    const svg = container.querySelector('[data-iris-chart="multi-line"]')!
    expect(svg.querySelector('title')?.textContent).toBe('Revenue and cost')
    expect(svg.querySelector('desc')?.textContent).toContain('2 series')
    expect(svg.querySelectorAll('[data-iris-chart-series-line]')).toHaveLength(2)
    expect(svg.querySelectorAll('[data-iris-chart-datum]')).toHaveLength(4)
    expect(container.querySelector('[data-iris-chart-legend]')?.textContent).toContain('Revenue')

    const point = svg.querySelector<SVGElement>('[data-iris-chart-datum]')!
    expect(point.getAttribute('tabindex')).toBe('0')
    fireEvent.focus(point)
    expect(onDatumFocus).toHaveBeenCalledWith(
      expect.objectContaining({ seriesId: 'revenue', categoryLabel: 'Jan', value: 10 }),
    )
  })
})

describe('IrisStackedBarChart (react)', () => {
  it('renders signed stacked bars and emits focus tooltip data', () => {
    const onDatumFocus = vi.fn()
    const { container } = render(
      <IrisStackedBarChart
        series={series}
        categories={['Jan', 'Feb']}
        onDatumFocus={onDatumFocus}
      />,
    )
    const svg = container.querySelector('[data-iris-chart="stacked-bar"]')!
    expect(svg.getAttribute('data-layout')).toBe('stacked')
    expect(svg.querySelectorAll('[data-iris-chart-datum]')).toHaveLength(4)
    const rect = svg.querySelector<SVGElement>('[data-iris-chart-datum]')!
    fireEvent.focus(rect)
    expect(onDatumFocus).toHaveBeenCalledWith(
      expect.objectContaining({ seriesId: 'revenue', categoryIndex: 0 }),
    )
  })
})

describe('IrisDonutChart (react)', () => {
  it('renders focusable donut arcs with native titles and safe empty data', () => {
    const onDatumFocus = vi.fn()
    const { container, rerender } = render(
      <IrisDonutChart
        data={slices}
        ariaDescription="Traffic sources"
        onDatumFocus={onDatumFocus}
      />,
    )
    const svg = container.querySelector('[data-iris-chart="donut"]')!
    expect(svg.querySelector('desc')?.textContent).toBe('Traffic sources')
    expect(svg.querySelectorAll('[data-iris-chart-datum]')).toHaveLength(2)
    const arc = svg.querySelector<SVGElement>('[data-iris-chart-datum]')!
    expect(arc.querySelector('title')?.textContent).toBe('Direct: 60 (60%)')
    fireEvent.focus(arc)
    expect(onDatumFocus).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'direct', percentage: 0.6 }),
    )

    rerender(
      <IrisDonutChart
        data={[
          {
            id: 'bad',
            label: 'Bad',
            colorToken: '--iris-chart-series-1',
            value: Number.NaN,
          },
        ]}
      />,
    )
    expect(
      container.querySelectorAll('[data-iris-chart="donut"] [data-iris-chart-datum]'),
    ).toHaveLength(0)
    expect(container.innerHTML).not.toContain('NaN')
  })
})
