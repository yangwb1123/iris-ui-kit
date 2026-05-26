import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisSpinner } from './Spinner'
import { __SPINNER_STYLE_ID, __resetSpinnerStyles } from './styles'

describe('IrisSpinner', () => {
  beforeEach(() => __resetSpinnerStyles())
  afterEach(() => __resetSpinnerStyles())

  it('renders an SVG circle', () => {
    const w = mount(IrisSpinner)
    expect(w.find('svg').exists()).toBe(true)
    expect(w.find('circle').exists()).toBe(true)
  })

  it('default size is 18px (md)', () => {
    const w = mount(IrisSpinner)
    const svg = w.find('svg')
    expect(svg.attributes('width')).toBe('18')
    expect(svg.attributes('height')).toBe('18')
  })

  it('sm/lg map to 14/24', () => {
    expect(mount(IrisSpinner, { props: { size: 'sm' } }).find('svg').attributes('width')).toBe('14')
    expect(mount(IrisSpinner, { props: { size: 'lg' } }).find('svg').attributes('width')).toBe('24')
  })

  it('accepts numeric size', () => {
    const w = mount(IrisSpinner, { props: { size: 40 } })
    expect(w.find('svg').attributes('width')).toBe('40')
  })

  it('uses the color prop as SVG color', () => {
    const w = mount(IrisSpinner, { props: { color: 'red' } })
    expect(w.find('svg').attributes('style')).toContain('color: red')
  })

  it('has role="status" and aria-live="polite"', () => {
    const w = mount(IrisSpinner)
    expect(w.attributes('role')).toBe('status')
    expect(w.attributes('aria-live')).toBe('polite')
  })

  it('renders the sr-only label by default', () => {
    const w = mount(IrisSpinner)
    expect(w.text()).toBe('Loading')
  })

  it('omits the label when blank', () => {
    const w = mount(IrisSpinner, { props: { label: '' } })
    expect(w.text()).toBe('')
  })

  it('injects the keyframes stylesheet once', () => {
    mount(IrisSpinner)
    mount(IrisSpinner)
    mount(IrisSpinner)
    expect(document.querySelectorAll(`#${__SPINNER_STYLE_ID}`)).toHaveLength(1)
  })

  it('strokeWidth defaults to ~12% of size, but can be overridden', () => {
    const w1 = mount(IrisSpinner, { props: { size: 50 } })
    expect(w1.find('circle').attributes('stroke-width')).toBe('6')
    const w2 = mount(IrisSpinner, { props: { size: 50, strokeWidth: 2 } })
    expect(w2.find('circle').attributes('stroke-width')).toBe('2')
  })
})
