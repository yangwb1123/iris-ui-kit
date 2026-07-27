import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/svelte'
import { tick } from 'svelte'
import IrisVirtualScroll from '../../virtual-scroll/IrisVirtualScroll.svelte'

afterEach(cleanup)

const many = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `N${i}`, age: i }))

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
// scrollToOffset — as exported functions on the component instance. Consumers
// needing programmatic scroll ref the IrisVirtualScroll directly (bind:this).
describe('@iris-ui-kit/svelte IrisVirtualScroll scrollToIndex handle', () => {
  it('shifts the host scroll offset to the target row and moves the window', async () => {
    const { component } = render(IrisVirtualScroll, {
      props: { items: many, itemHeight: 36, height: 200 },
    })
    await tick()
    // Initially anchored at the top: index 0 rendered, scroll offset 0.
    expect(root().scrollTop).toBe(0)
    expect(renderedIndices()).toContain(0)

    // Scroll to row 40 → the host element jumps to that row's top (40 * 36).
    ;(component as unknown as { scrollToIndex: (i: number) => void }).scrollToIndex(40)
    expect(root().scrollTop).toBe(40 * 36)

    // Drive the scroll event so the window recomputes (mirrors a real scroll).
    root().dispatchEvent(new Event('scroll'))
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    await tick()
    const idxs = renderedIndices()
    expect(Math.min(...idxs)).toBeGreaterThan(0)
    expect(idxs).toContain(40)
  })

  it('align="end" positions the row at the viewport bottom', async () => {
    const { component } = render(IrisVirtualScroll, {
      props: { items: many, itemHeight: 36, height: 200 },
    })
    await tick()
    // jsdom reports clientHeight 0, so the virtualizer's viewport collapses to 0:
    // align=end → start - viewport + size = 40*36 - 0 + 36 = 1476.
    ;(component as unknown as { scrollToIndex: (i: number, a: 'end') => void }).scrollToIndex(
      40,
      'end',
    )
    expect(root().scrollTop).toBe(40 * 36 + 36)
  })

  it('also exposes scrollToOffset (clamped to the scrollable range)', async () => {
    const { component } = render(IrisVirtualScroll, {
      props: { items: many, itemHeight: 36, height: 200 },
    })
    await tick()
    ;(component as unknown as { scrollToOffset: (px: number) => void }).scrollToOffset(360)
    expect(root().scrollTop).toBe(360)
  })
})
