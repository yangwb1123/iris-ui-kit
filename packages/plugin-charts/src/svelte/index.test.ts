import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/svelte'
import IrisLineChart from './IrisLineChart.svelte'
import IrisBarChart from './IrisBarChart.svelte'
import IrisSparkline from './IrisSparkline.svelte'

describe('IrisLineChart (svelte)', () => {
  it('renders an SVG with a line path', () => {
    const { container } = render(IrisLineChart, { props: { data: [1, 4, 2, 5] } })
    const svg = container.querySelector('[data-iris-chart="line"]')
    expect(svg).toBeTruthy()
    expect(svg?.querySelector('path[stroke="var(--iris-chart-line)"]')).toBeTruthy()
  })
  it('adds an area path when area is set', () => {
    const { container } = render(IrisLineChart, { props: { data: [1, 2, 3], area: true } })
    expect(container.querySelector('path[fill="var(--iris-chart-area)"]')).toBeTruthy()
  })
})

describe('IrisBarChart (svelte)', () => {
  it('renders one rect per value', () => {
    const { container } = render(IrisBarChart, { props: { data: [3, 1, 4] } })
    expect(container.querySelectorAll('[data-iris-chart="bar"] rect')).toHaveLength(3)
  })
})

describe('IrisSparkline (svelte)', () => {
  it('renders a compact line with an accessible label', () => {
    const { container } = render(IrisSparkline, {
      props: { data: [1, 2, 1, 3], ariaLabel: 'Sales trend' },
    })
    const svg = container.querySelector('[data-iris-chart="sparkline"]')
    expect(svg?.getAttribute('aria-label')).toBe('Sales trend')
  })
})
