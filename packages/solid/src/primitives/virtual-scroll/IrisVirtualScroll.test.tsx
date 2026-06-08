import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@solidjs/testing-library'
import { IrisVirtualScroll } from './IrisVirtualScroll'

afterEach(cleanup)

const items = Array.from({ length: 100 }, (_, i) => ({ id: i, label: `Item ${i}` }))

describe('IrisVirtualScroll', () => {
  it('renders without crashing', () => {
    const { container } = render(() => (
      <IrisVirtualScroll
        items={items}
        itemHeight={40}
        height={200}
        renderItem={(item) => <div>{(item as { label: string }).label}</div>}
      />
    ))
    expect(container.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
  })

  it('renders a spacer sized to total virtual height', () => {
    const { container } = render(() => (
      <IrisVirtualScroll
        items={items}
        itemHeight={40}
        height={200}
        renderItem={(item) => <div>{(item as { label: string }).label}</div>}
      />
    ))
    const spacer = container.querySelector('[data-iris-virtual-spacer]') as HTMLElement
    expect(spacer).not.toBeNull()
    expect(spacer.style.height).toBe(`${100 * 40}px`)
  })

  it('renders only a subset of items (virtual window)', () => {
    const { container } = render(() => (
      <IrisVirtualScroll
        items={items}
        itemHeight={40}
        height={200}
        buffer={0}
        renderItem={(item) => <div>{(item as { label: string }).label}</div>}
      />
    ))
    const rendered = container.querySelectorAll('[data-iris-virtual-item]')
    // Should not render all 100 items
    expect(rendered.length).toBeLessThan(100)
  })

  it('renders item content for visible items', () => {
    const { getByText } = render(() => (
      <IrisVirtualScroll
        items={[
          { id: 0, label: 'First item' },
          { id: 1, label: 'Second item' },
        ]}
        itemHeight={40}
        height={200}
        renderItem={(item) => <div>{(item as { label: string }).label}</div>}
      />
    ))
    expect(getByText('First item')).toBeTruthy()
  })
})
