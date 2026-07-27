import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { IrisTimeline, type IrisTimelineItem } from './Timeline'

afterEach(() => cleanup())

const ITEMS: IrisTimelineItem[] = [
  { title: 'Created', description: 'Order placed', time: '09:00', variant: 'success' },
  { title: 'Shipped', time: '12:00' },
  { title: 'Delivered' },
]

describe('@iris-ui-kit/react IrisTimeline', () => {
  it('renders an ordered list of items', () => {
    const { container } = render(<IrisTimeline items={ITEMS} />)
    expect(container.querySelector('ol[data-iris-timeline]')).not.toBeNull()
    expect(container.querySelectorAll('[data-iris-timeline-item]').length).toBe(3)
  })

  it('renders time / title / description', () => {
    const { container } = render(<IrisTimeline items={ITEMS} />)
    expect(container.querySelector('[data-iris-timeline-time]')?.textContent).toBe('09:00')
    expect(container.querySelector('[data-iris-timeline-title]')?.textContent).toBe('Created')
    expect(container.querySelector('[data-iris-timeline-desc]')?.textContent).toBe('Order placed')
  })

  it('draws a connector for all but the last item', () => {
    const { container } = render(<IrisTimeline items={ITEMS} />)
    expect(container.querySelectorAll('[data-iris-timeline-line]').length).toBe(2)
  })

  it('applies the variant to the item', () => {
    const { container } = render(<IrisTimeline items={ITEMS} />)
    expect(container.querySelector('[data-iris-timeline-item]')?.getAttribute('data-variant')).toBe(
      'success',
    )
  })

  it('custom color overrides the dot color', () => {
    const { container } = render(<IrisTimeline items={[{ title: 'x', color: 'rgb(1, 2, 3)' }]} />)
    const dot = container.querySelector('[data-iris-timeline-dot]') as HTMLElement
    expect(dot.style.background).toBe('rgb(1, 2, 3)')
  })

  it('renderItem replaces the default content', () => {
    const { container } = render(
      <IrisTimeline
        items={ITEMS}
        renderItem={(it) => <span data-custom="">{`#${it.title}`}</span>}
      />,
    )
    expect(container.querySelector('[data-custom]')?.textContent).toBe('#Created')
    expect(container.querySelector('[data-iris-timeline-title]')).toBeNull()
  })
})
