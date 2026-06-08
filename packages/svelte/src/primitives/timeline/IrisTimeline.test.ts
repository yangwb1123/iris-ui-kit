import { render } from '@testing-library/svelte'
import { describe, it, expect } from 'vitest'
import IrisTimeline from './IrisTimeline.svelte'

describe('IrisTimeline', () => {
  it('renders timeline items', () => {
    const items = [
      { title: 'Step One', time: '2024-01-01', description: 'First event' },
      { title: 'Step Two', time: '2024-01-02', variant: 'success' as const },
    ]
    const { container } = render(IrisTimeline, { props: { items } })
    const el = container.querySelector('[data-iris-timeline]')
    expect(el).toBeTruthy()
    const lis = container.querySelectorAll('[data-iris-timeline-item]')
    expect(lis.length).toBe(2)
  })

  it('renders title and description', () => {
    const items = [{ title: 'Hello', description: 'World' }]
    const { getByText } = render(IrisTimeline, { props: { items } })
    expect(getByText('Hello')).toBeTruthy()
    expect(getByText('World')).toBeTruthy()
  })
})
