import { afterEach, describe, expect, it } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisTimeline } from './IrisTimeline'

afterEach(cleanup)

describe('IrisTimeline', () => {
  it('renders empty timeline', () => {
    const { container } = render(() => <IrisTimeline items={[]} />)
    expect(container.querySelector('[data-iris-timeline]')).not.toBeNull()
  })

  it('renders items with titles', () => {
    const items = [
      { key: '1', title: 'Event 1', time: '2024-01-01' },
      { key: '2', title: 'Event 2', description: 'Details here' },
    ]
    const { getAllByRole, getByText } = render(() => <IrisTimeline items={items} />)
    expect(getAllByRole('listitem').length).toBe(2)
    expect(getByText('Event 1')).toBeTruthy()
    expect(getByText('2024-01-01')).toBeTruthy()
    expect(getByText('Details here')).toBeTruthy()
  })

  it('renders custom item content instead of the default fields', () => {
    const items = [
      { key: '1', title: 'Event 1', time: 'Time 1', description: 'Description 1' },
      { key: '2', title: 'Event 2', time: 'Time 2', description: 'Description 2' },
    ]
    const { container, getByText } = render(() => (
      <IrisTimeline
        items={items}
        renderItem={(item, index) => (
          <span data-custom-timeline-item="">{`Custom ${index}: ${item.title}`}</span>
        )}
      />
    ))

    expect(getByText('Custom 0: Event 1')).toBeTruthy()
    expect(getByText('Custom 1: Event 2')).toBeTruthy()
    expect(container.querySelectorAll('[data-custom-timeline-item]')).toHaveLength(2)
    expect(container.querySelector('[data-iris-timeline-time]')).toBeNull()
    expect(container.querySelector('[data-iris-timeline-title]')).toBeNull()
    expect(container.querySelector('[data-iris-timeline-desc]')).toBeNull()
  })

  it('applies variant color to dots', () => {
    const items = [{ key: '1', title: 'Success', variant: 'success' as const }]
    const { container } = render(() => <IrisTimeline items={items} />)
    const item = container.querySelector('[data-iris-timeline-item]')!
    expect(item.getAttribute('data-variant')).toBe('success')
  })

  it('last item has no connector line', () => {
    const items = [{ title: 'Only' }]
    const { container } = render(() => <IrisTimeline items={items} />)
    expect(container.querySelector('[data-iris-timeline-line]')).toBeNull()
  })
})
