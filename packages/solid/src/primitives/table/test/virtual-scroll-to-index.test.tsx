import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@solidjs/testing-library'
import {
  IrisVirtualScroll,
  type IrisVirtualScrollHandle,
} from '../../virtual-scroll/IrisVirtualScroll'

afterEach(cleanup)

interface Row {
  id: number
  name: string
  age: number
}

const many: Row[] = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `N${i}`, age: i }))

const renderRow = (row: Row) => <span>{row.name}</span>

function root(): HTMLDivElement {
  return document.querySelector('[data-iris-virtual-scroll]') as HTMLDivElement
}

function renderedIndices(): number[] {
  return Array.from(document.querySelectorAll('[data-iris-virtual-index]')).map((el) =>
    Number(el.getAttribute('data-iris-virtual-index')),
  )
}

// The IrisVirtualScroll component (what the base Table virtualizes its body with)
// exposes the createVirtualizer-backed imperative handle — scrollToIndex /
// scrollToOffset — via its `ref` setter. Consumers needing programmatic scroll
// ref the IrisVirtualScroll directly.
describe('@iris-ui-kit/solid IrisVirtualScroll scrollToIndex handle', () => {
  it('shifts the host scroll offset to the target row and moves the window', async () => {
    let handle: IrisVirtualScrollHandle | undefined
    render(() => (
      <IrisVirtualScroll
        items={many}
        itemHeight={36}
        height={200}
        renderItem={renderRow}
        ref={(h) => (handle = h)}
      />
    ))
    // Initially anchored at the top: index 0 rendered, scroll offset 0.
    expect(root().scrollTop).toBe(0)
    expect(renderedIndices()).toContain(0)

    // Scroll to row 40 → the host element jumps to that row's top (40 * 36).
    handle!.scrollToIndex(40)
    expect(root().scrollTop).toBe(40 * 36)

    // Drive the scroll event so the window recomputes (mirrors a real scroll).
    fireEvent.scroll(root())
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const idxs = renderedIndices()
    expect(Math.min(...idxs)).toBeGreaterThan(0)
    expect(idxs).toContain(40)
  })

  it('align="end" positions the row at the viewport bottom', () => {
    let handle: IrisVirtualScrollHandle | undefined
    render(() => (
      <IrisVirtualScroll
        items={many}
        itemHeight={36}
        height={200}
        renderItem={renderRow}
        ref={(h) => (handle = h)}
      />
    ))
    // jsdom reports clientHeight 0, so the virtualizer's viewport collapses to 0:
    // align=end → start - viewport + size = 40*36 - 0 + 36 = 1476.
    handle!.scrollToIndex(40, 'end')
    expect(root().scrollTop).toBe(40 * 36 + 36)
  })

  it('also exposes scrollToOffset (clamped to the scrollable range)', () => {
    let handle: IrisVirtualScrollHandle | undefined
    render(() => (
      <IrisVirtualScroll
        items={many}
        itemHeight={36}
        height={200}
        renderItem={renderRow}
        ref={(h) => (handle = h)}
      />
    ))
    handle!.scrollToOffset(360)
    expect(root().scrollTop).toBe(360)
  })
})
