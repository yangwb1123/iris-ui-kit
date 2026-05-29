import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisScrollArea } from './ScrollArea'

const el = (w: ReturnType<typeof mount>) => w.find('[data-iris-scroll-area]').element as HTMLElement

describe('IrisScrollArea', () => {
  it('renders slot content', () => {
    const w = mount(IrisScrollArea, { slots: { default: '<p data-child="">Body</p>' } })
    expect(w.find('[data-child]').text()).toBe('Body')
  })

  it('defaults to vertical scrolling', () => {
    const w = mount(IrisScrollArea)
    expect(w.find('[data-iris-scroll-area]').attributes('data-axis')).toBe('vertical')
    expect(el(w).style.overflowY).toBe('auto')
    expect(el(w).style.overflowX).toBe('hidden')
  })

  it('horizontal axis scrolls on X', () => {
    const w = mount(IrisScrollArea, { props: { axis: 'horizontal' } })
    expect(w.find('[data-iris-scroll-area]').attributes('data-axis')).toBe('horizontal')
    expect(el(w).style.overflowX).toBe('auto')
  })

  it('applies a numeric maxHeight as px', () => {
    const w = mount(IrisScrollArea, { props: { maxHeight: 200 } })
    expect(el(w).style.maxHeight).toBe('200px')
  })

  it('is keyboard-focusable', () => {
    const w = mount(IrisScrollArea)
    expect(w.find('[data-iris-scroll-area]').attributes('tabindex')).toBe('0')
  })
})
