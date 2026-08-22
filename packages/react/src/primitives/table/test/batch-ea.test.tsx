import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

/**
 * Batch EA (iris 独有 — vxe has no floating back-to-top): scrollToTop shows a
 * bottom-right ↑ button once the effective scroller passes 200px (the
 * fixed-height root, or the virtual-scroll viewport when present), and a
 * click scrolls it back to top (scrollTo with a scrollTop fallback;
 * reduced-motion → 'auto').
 */

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const cols: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const rows: Row[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  name: `R${i + 1}`,
  age: 10 + i,
}))

const tableRoot = (): HTMLElement => document.querySelector('[data-iris-table]') as HTMLElement
const virtualViewport = (): HTMLElement | null =>
  document.querySelector('[data-iris-virtual-scroll]')
const backTop = (): HTMLElement | null => document.querySelector('[data-iris-back-top-table]')
const backTopAnchor = (): HTMLElement | null =>
  document.querySelector('[data-iris-back-top-anchor]')

/** Set scrollTop then dispatch a scroll so the native listener reads it back. */
function scrollTo(el: HTMLElement, top: number): void {
  el.scrollTop = top
  fireEvent.scroll(el)
}

function mockMatchMedia(matches: boolean) {
  return vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: () => false,
  }))
}

function stubScrollTo(el: HTMLElement, spy: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(el, 'scrollTo', { configurable: true, value: spy })
}

describe('@iris-ui-kit/react IrisTable back-to-top (batch EA, iris 独有)', () => {
  it('no scrollToTop → never appears (fail-closed)', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" height={300} />)
    scrollTo(tableRoot(), 500)
    expect(backTop()).toBeNull()
    expect(backTopAnchor()).toBeNull()
  })

  it('below the threshold at mount → zero nodes', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />)
    expect(backTop()).toBeNull()
    expect(backTopAnchor()).toBeNull()
  })

  it('appears once the fixed-height root passes the 200px threshold', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />)
    scrollTo(tableRoot(), 300)
    const btn = backTop()
    expect(btn).not.toBeNull()
    expect(backTopAnchor()).not.toBeNull()
    // The IrisBackTop recipe: accessible label from the existing i18n key.
    expect(btn!.getAttribute('aria-label')).toBe('Back to top')
    expect(btn!.textContent).toBe('↑')
  })

  it('threshold boundary: exactly 200 shows, 199 hides', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />)
    scrollTo(tableRoot(), 199)
    expect(backTop()).toBeNull()
    scrollTo(tableRoot(), 200)
    expect(backTop()).not.toBeNull()
    scrollTo(tableRoot(), 199)
    expect(backTop()).toBeNull()
  })

  it('disappears when scrolled back above the threshold', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />)
    scrollTo(tableRoot(), 500)
    expect(backTop()).not.toBeNull()
    scrollTo(tableRoot(), 120)
    expect(backTop()).toBeNull()
  })

  it('click scrolls the root back to top via the scrollTop fallback', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />)
    scrollTo(tableRoot(), 500)
    fireEvent.click(backTop()!)
    // jsdom has no Element.scrollTo → the recipe's scrollTop = 0 fallback.
    expect(tableRoot().scrollTop).toBe(0)
  })

  it('click uses scrollTo({ top: 0, behavior: smooth }) when available', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />)
    const spy = vi.fn()
    stubScrollTo(tableRoot(), spy)
    scrollTo(tableRoot(), 500)
    fireEvent.click(backTop()!)
    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('reduced motion forces behavior auto', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(true))
    render(<IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />)
    const spy = vi.fn()
    stubScrollTo(tableRoot(), spy)
    scrollTo(tableRoot(), 500)
    fireEvent.click(backTop()!)
    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('virtual path: the virtual-scroll viewport is the effective scroller', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        scrollToTop
        virtualScroll={{ height: 160, itemHeight: 40 }}
      />,
    )
    const viewport = virtualViewport()
    expect(viewport).not.toBeNull()
    // The root never scrolls in virtual mode — a root-only scroll does NOT
    // trigger the button (the listener sits on the effective scroller)…
    scrollTo(tableRoot(), 300)
    expect(backTop()).toBeNull()
    tableRoot().scrollTop = 0 // undo the manual probe — virtual roots never scroll
    // …scrolling the viewport shows it while the root stays at 0.
    scrollTo(viewport!, 320)
    expect(backTop()).not.toBeNull()
    expect(tableRoot().scrollTop).toBe(0)
  })

  it('virtual path: click resets the viewport to top', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        scrollToTop
        virtualScroll={{ height: 160, itemHeight: 40 }}
      />,
    )
    const viewport = virtualViewport()!
    scrollTo(viewport, 320)
    fireEvent.click(backTop()!)
    expect(viewport.scrollTop).toBe(0)
  })

  it('virtual path: click ScrollTo path targets the viewport', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        scrollToTop
        virtualScroll={{ height: 160, itemHeight: 40 }}
      />,
    )
    const viewport = virtualViewport()!
    const spy = vi.fn()
    stubScrollTo(viewport, spy)
    scrollTo(viewport, 320)
    fireEvent.click(backTop()!)
    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    expect(tableRoot().scrollTop).toBe(0) // root untouched
  })

  it('async flow: viewport mounting after empty data re-arms the listener', () => {
    // The canonical loading → data path: the virtual viewport does not exist
    // while the table is empty, and scroll events don't bubble — the effect
    // must re-arm on the data-presence flip so the button follows the
    // effective scroller once rows arrive.
    const { rerender } = render(
      <IrisTable
        columns={cols}
        data={[]}
        rowKey="id"
        scrollToTop
        virtualScroll={{ height: 160, itemHeight: 40 }}
      />,
    )
    expect(virtualViewport()).toBeNull()
    rerender(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        scrollToTop
        virtualScroll={{ height: 160, itemHeight: 40 }}
      />,
    )
    const viewport = virtualViewport()
    expect(viewport).not.toBeNull()
    // The re-armed listener follows the NEW effective scroller via event-time
    // resolution: a root probe stays inert (it reads the viewport, at 0) —
    // the stranded-root bug would have kept showing the stale probe value.
    scrollTo(tableRoot(), 300)
    expect(backTop()).toBeNull()
    tableRoot().scrollTop = 0 // undo the manual probe — virtual roots never scroll
    scrollTo(viewport!, 320)
    expect(backTop()).not.toBeNull()
    // Click resets the effective scroller (the viewport), not the root.
    fireEvent.click(backTop()!)
    expect(viewport!.scrollTop).toBe(0)
    expect(tableRoot().scrollTop).toBe(0)
  })

  it('async flow: fixed-height path keeps working after data arrival', () => {
    const { rerender } = render(
      <IrisTable columns={cols} data={[]} rowKey="id" height={300} scrollToTop />,
    )
    rerender(<IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />)
    scrollTo(tableRoot(), 500)
    expect(backTop()).not.toBeNull()
    fireEvent.click(backTop()!)
    expect(tableRoot().scrollTop).toBe(0)
  })

  it('state survives re-renders (listener keeps working)', () => {
    const { rerender } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />,
    )
    scrollTo(tableRoot(), 500)
    expect(backTop()).not.toBeNull()
    rerender(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        height={300}
        scrollToTop
        bordered={false}
      />,
    )
    expect(backTop()).not.toBeNull()
    scrollTo(tableRoot(), 600)
    expect(backTop()).not.toBeNull()
  })

  it('turning scrollToTop off cleans the listener and the node', () => {
    const { rerender } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />,
    )
    scrollTo(tableRoot(), 500)
    expect(backTop()).not.toBeNull()
    rerender(<IrisTable columns={cols} data={rows} rowKey="id" height={300} />)
    expect(backTop()).toBeNull()
    scrollTo(tableRoot(), 700)
    expect(backTop()).toBeNull()
  })

  it('unmount removes the floating button', () => {
    const { unmount } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />,
    )
    scrollTo(tableRoot(), 500)
    expect(backTop()).not.toBeNull()
    unmount()
    expect(backTop()).toBeNull()
  })

  it('onScroll prop stays independent of the back-to-top listener', () => {
    const onScroll = vi.fn()
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        height={300}
        scrollToTop
        onScroll={onScroll}
      />,
    )
    scrollTo(tableRoot(), 500)
    expect(backTop()).not.toBeNull()
    expect(onScroll).toHaveBeenCalledWith(expect.objectContaining({ scrollTop: 500 }))
  })

  it('printable suppresses the button', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop printable />)
    scrollTo(tableRoot(), 500)
    expect(backTop()).toBeNull()
  })

  it('style contract: sticky zero-height anchor + corner button, token-driven', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" height={300} scrollToTop />)
    scrollTo(tableRoot(), 500)
    const anchor = backTopAnchor()!
    // Sticky zero-height endcap — pins to the viewport, zero layout footprint.
    expect(anchor.style.position).toBe('sticky')
    expect(anchor.style.height).toBe('0px')
    expect(anchor.style.pointerEvents).toBe('none')
    // z 3: above sticky header (z 2) / pinned columns (z 1), below panels.
    expect(anchor.style.zIndex).toBe('3')
    const btn = backTop()!
    // 40×40 round button at the bottom-right corner (RTL-safe logical props).
    expect(btn.style.width).toBe('40px')
    expect(btn.style.height).toBe('40px')
    expect(btn.style.borderRadius).toBe('50%')
    expect(btn.style.insetBlockEnd).toBe('24px')
    expect(btn.style.insetInlineEnd).toBe('24px')
    expect(btn.style.pointerEvents).toBe('auto')
    // Token-driven colors / shadow / font — no hex, no bare numbers.
    expect(btn.style.background).toBe('var(--iris-surface, var(--iris-background))')
    expect(btn.style.color).toBe('var(--iris-foreground)')
    expect(btn.style.boxShadow).toBe('var(--iris-shadow-md)')
    expect(btn.style.fontSize).toBe('var(--iris-font-size-xl, 18px)')
  })
})
