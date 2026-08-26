import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns = [{ key: 'name', title: 'Name' }]
const rows: Row[] = Array.from({ length: 20 }, (_, index) => ({
  id: index + 1,
  name: `Row ${index + 1}`,
}))

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function tableRoot(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-table]') as HTMLElement
}

function viewport(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-virtual-scroll]') as HTMLElement
}

function backTop(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-back-top-table]')
}

function scroll(element: HTMLElement, top: number): void {
  element.scrollTop = top
  fireEvent.scroll(element)
}

function stubScrollTo(element: HTMLElement, spy: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(element, 'scrollTo', { configurable: true, value: spy })
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

const constrainedStyle = 'height: 160px; overflow: auto'

describe('Svelte IrisTable scrollToTop', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', mockMatchMedia(false))
  })

  it('is default-off and does not attach a visible control', () => {
    const { container } = render(IrisTable, {
      props: { columns, data: rows, style: constrainedStyle },
    })
    scroll(tableRoot(container), 400)
    expect(backTop(container)).toBeNull()
  })

  it('shows at the inclusive 200px threshold and hides below it', () => {
    const { container } = render(IrisTable, {
      props: { columns, data: rows, scrollToTop: true, style: constrainedStyle },
    })
    const root = tableRoot(container)
    scroll(root, 199)
    expect(backTop(container)).toBeNull()
    scroll(root, 200)
    expect(backTop(container)).not.toBeNull()
    expect(backTop(container)?.getAttribute('aria-label')).toBe('Back to top')
    expect(backTop(container)?.getAttribute('title')).toBe('Back to top')
    scroll(root, 199)
    expect(backTop(container)).toBeNull()
  })

  it('uses smooth scrolling and falls back to scrollTop', () => {
    const { container } = render(IrisTable, {
      props: { columns, data: rows, scrollToTop: true, style: constrainedStyle },
    })
    const root = tableRoot(container)
    const spy = vi.fn()
    stubScrollTo(root, spy)
    scroll(root, 400)
    fireEvent.click(backTop(container)!)
    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })

    spy.mockImplementation(() => {
      throw new Error('options unsupported')
    })
    root.scrollTop = 400
    fireEvent.click(backTop(container)!)
    expect(root.scrollTop).toBe(0)
  })

  it('uses auto behavior when reduced motion is preferred', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(true))
    const { container } = render(IrisTable, {
      props: { columns, data: rows, scrollToTop: true, style: constrainedStyle },
    })
    const root = tableRoot(container)
    const spy = vi.fn()
    stubScrollTo(root, spy)
    scroll(root, 400)
    fireEvent.click(backTop(container)!)
    expect(spy).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('uses the virtual viewport as the effective scroller', () => {
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        scrollToTop: true,
        virtualScroll: { height: 160, itemHeight: 40 },
      },
    })
    const root = tableRoot(container)
    const scroller = viewport(container)
    scroll(root, 400)
    expect(backTop(container)).toBeNull()
    scroll(scroller, 400)
    expect(backTop(container)).not.toBeNull()
    fireEvent.click(backTop(container)!)
    expect(scroller.scrollTop).toBe(0)
  })

  it('re-arms after a virtual viewport mounts with data', async () => {
    const rendered = render(IrisTable, {
      props: {
        columns,
        data: [],
        scrollToTop: true,
        virtualScroll: { height: 160, itemHeight: 40 },
      },
    })
    expect(rendered.container.querySelector('[data-iris-virtual-scroll]')).toBeNull()
    await rendered.rerender({
      columns,
      data: rows,
      scrollToTop: true,
      virtualScroll: { height: 160, itemHeight: 40 },
      loading: false,
      error: false,
    })
    const scroller = viewport(rendered.container)
    scroll(scroller, 400)
    expect(backTop(rendered.container)).not.toBeNull()
  })

  it('hides during loading/error remounts and re-arms the new virtual viewport', async () => {
    const rendered = render(IrisTable, {
      props: {
        columns,
        data: rows,
        scrollToTop: true,
        virtualScroll: { height: 160, itemHeight: 40 },
      },
    })
    const first = viewport(rendered.container)
    scroll(first, 320)
    expect(backTop(rendered.container)).not.toBeNull()

    await rendered.rerender({
      columns,
      data: rows,
      scrollToTop: true,
      loading: true,
      virtualScroll: { height: 160, itemHeight: 40 },
    })
    expect(viewport(rendered.container)).toBeNull()
    expect(backTop(rendered.container)).toBeNull()

    await rendered.rerender({
      columns,
      data: rows,
      scrollToTop: true,
      virtualScroll: { height: 160, itemHeight: 40 },
      loading: false,
      error: false,
    })
    const afterLoading = viewport(rendered.container)
    expect(afterLoading).not.toBeNull()
    scroll(afterLoading, 320)
    expect(backTop(rendered.container)).not.toBeNull()

    await rendered.rerender({
      columns,
      data: rows,
      scrollToTop: true,
      error: true,
      virtualScroll: { height: 160, itemHeight: 40 },
      loading: false,
    })
    expect(viewport(rendered.container)).toBeNull()
    expect(backTop(rendered.container)).toBeNull()
  })

  it('removes the listener when disabled and on unmount', async () => {
    const rendered = render(IrisTable, {
      props: {
        columns,
        data: rows,
        scrollToTop: true,
        virtualScroll: { height: 160, itemHeight: 40 },
      },
    })
    const scroller = viewport(rendered.container)
    const removeEventListener = vi.spyOn(scroller, 'removeEventListener')
    await rendered.rerender({ columns, data: rows, scrollToTop: false })
    expect(removeEventListener).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(backTop(rendered.container)).toBeNull()
    rendered.unmount()
  })

  it('suppresses the control in printable mode', () => {
    const { container } = render(IrisTable, {
      props: {
        columns,
        data: rows,
        scrollToTop: true,
        printable: true,
        virtualScroll: { height: 160, itemHeight: 40 },
      },
    })
    scroll(viewport(container), 400)
    expect(backTop(container)).toBeNull()
  })
})
