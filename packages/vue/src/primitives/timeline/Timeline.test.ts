import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { IrisTimeline, type IrisTimelineItem } from './Timeline'

const ITEMS: IrisTimelineItem[] = [
  { title: 'Created', description: 'Order placed', time: '09:00', variant: 'success' },
  { title: 'Shipped', time: '12:00' },
  { title: 'Delivered' },
]

describe('IrisTimeline', () => {
  it('renders an ordered list of items', () => {
    const w = mount(IrisTimeline, { props: { items: ITEMS } })
    expect(w.find('ol[data-iris-timeline]').exists()).toBe(true)
    expect(w.findAll('[data-iris-timeline-item]').length).toBe(3)
  })

  it('renders time / title / description', () => {
    const w = mount(IrisTimeline, { props: { items: ITEMS } })
    expect(w.find('[data-iris-timeline-time]').text()).toBe('09:00')
    expect(w.find('[data-iris-timeline-title]').text()).toBe('Created')
    expect(w.find('[data-iris-timeline-desc]').text()).toBe('Order placed')
  })

  it('draws a connector for all but the last item', () => {
    const w = mount(IrisTimeline, { props: { items: ITEMS } })
    expect(w.findAll('[data-iris-timeline-line]').length).toBe(2)
  })

  it('applies the variant to the item', () => {
    const w = mount(IrisTimeline, { props: { items: ITEMS } })
    expect(w.find('[data-iris-timeline-item]').attributes('data-variant')).toBe('success')
  })

  it('custom color overrides the dot color', () => {
    const w = mount(IrisTimeline, { props: { items: [{ title: 'x', color: 'rgb(1, 2, 3)' }] } })
    const dot = w.find('[data-iris-timeline-dot]').element as HTMLElement
    expect(dot.style.background).toBe('rgb(1, 2, 3)')
  })

  it('#item slot replaces the default content', () => {
    const w = mount(IrisTimeline, {
      props: { items: ITEMS },
      slots: { item: '<span data-custom="">custom</span>' },
    })
    expect(w.find('[data-custom]').exists()).toBe(true)
    expect(w.find('[data-iris-timeline-title]').exists()).toBe(false)
  })
})
