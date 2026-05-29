import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisProgress } from './Progress'
import { __PROGRESS_STYLE_ID, __resetProgressStyles } from './styles'

describe('IrisProgress', () => {
  beforeEach(() => __resetProgressStyles())
  afterEach(() => __resetProgressStyles())

  it('renders with role="progressbar"', () => {
    const w = mount(IrisProgress, { props: { value: 40 } })
    expect(w.attributes('role')).toBe('progressbar')
  })

  it('sets aria-valuemin/max/now for determinate', () => {
    const w = mount(IrisProgress, { props: { value: 30, max: 60 } })
    expect(w.attributes('aria-valuemin')).toBe('0')
    expect(w.attributes('aria-valuemax')).toBe('60')
    expect(w.attributes('aria-valuenow')).toBe('30')
  })

  it('clamps value to [0, max]', () => {
    const w1 = mount(IrisProgress, { props: { value: -5 } })
    expect(w1.attributes('aria-valuenow')).toBe('0')
    const w2 = mount(IrisProgress, { props: { value: 200, max: 100 } })
    expect(w2.attributes('aria-valuenow')).toBe('100')
  })

  it('bar width reflects percent', () => {
    const w = mount(IrisProgress, { props: { value: 25, max: 100 } })
    const bar = w.find('[data-iris-progress-bar]')
    expect(bar.attributes('style')).toContain('width: 25%')
  })

  it('value=null → indeterminate', () => {
    const w = mount(IrisProgress)
    expect(w.attributes('data-state')).toBe('indeterminate')
    expect(w.attributes('aria-valuenow')).toBeUndefined()
  })

  it('indeterminate=true forces indeterminate even if value is given', () => {
    const w = mount(IrisProgress, { props: { value: 50, indeterminate: true } })
    expect(w.attributes('data-state')).toBe('indeterminate')
    expect(w.attributes('aria-valuenow')).toBeUndefined()
  })

  it('tone "success" uses --iris-success', () => {
    const w = mount(IrisProgress, { props: { value: 50, tone: 'success' } })
    const bar = w.find('[data-iris-progress-bar]')
    expect(bar.attributes('style')).toContain('--iris-success')
  })

  it('size sm/md changes height', () => {
    expect(mount(IrisProgress, { props: { value: 0, size: 'sm' } }).attributes('style')).toContain(
      'height: 4px',
    )
    expect(mount(IrisProgress, { props: { value: 0, size: 'md' } }).attributes('style')).toContain(
      'height: 8px',
    )
  })

  it('installs the stylesheet once', () => {
    mount(IrisProgress)
    mount(IrisProgress)
    expect(document.querySelectorAll(`#${__PROGRESS_STYLE_ID}`)).toHaveLength(1)
  })

  it('updates aria-valuenow when value changes', async () => {
    const w = mount(IrisProgress, { props: { value: 10 } })
    expect(w.attributes('aria-valuenow')).toBe('10')
    await w.setProps({ value: 80 })
    expect(w.attributes('aria-valuenow')).toBe('80')
  })
})
