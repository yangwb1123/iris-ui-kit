import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisLineChart, IrisBarChart, IrisSparkline } from './index'

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
