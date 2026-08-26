import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = Array.from({ length: 20 }, (_, index) => ({
  id: index + 1,
  name: `Row ${index + 1}`,
}))

function root(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-table]') as HTMLElement
}

function viewport(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-virtual-scroll]')
}

function backTop(container: HTMLElement): HTMLElement | null {
  return container.querySelector('[data-iris-back-top-table]')
}

function scrollTo(element: HTMLElement, top: number): void {
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

const fixedStyle = { height: '160px', overflow: 'auto' } as const

describe('Solid IrisTable scrollToTop (batch FT)', () => {
  beforeEach(() => {
    // IrisVirtualScroll batches its own scroll state through rAF; the table
    // back-to-top bridge remains synchronous and reads the native scrollTop.
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) => {
      callback(0)
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  it('is default-off and installs no scroll listener', () => {
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} style={fixedStyle} />
    ))
    const table = root(container)
    const addScroll = vi.spyOn(table, 'addEventListener')
    scrollTo(table, 400)
    expect(backTop(container)).toBeNull()
    expect(addScroll).not.toHaveBeenCalledWith('scroll', expect.any(Function), true)
  })

  it('shows at the inclusive 200px threshold and hides below it', () => {
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} scrollToTop style={fixedStyle} />
    ))
    const table = root(container)
    expect(backTop(container)).toBeNull()
    scrollTo(table, 199)
    expect(backTop(container)).toBeNull()
    scrollTo(table, 200)
    const button = backTop(container)
    expect(button).not.toBeNull()
    expect(button?.getAttribute('aria-label')).toBe('Back to top')
    expect(button?.getAttribute('title')).toBe('Back to top')
    expect(button?.textContent).toBe('↑')
    expect(container.querySelector('[data-iris-back-top-anchor]')).not.toBeNull()
    scrollTo(table, 199)
    expect(backTop(container)).toBeNull()
  })

  it('uses smooth scrollTo when available and falls back when it throws', () => {
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} scrollToTop style={fixedStyle} />
    ))
    const table = root(container)
    const scrollToSpy = vi.fn()
    stubScrollTo(table, scrollToSpy)
    scrollTo(table, 400)
    fireEvent.click(backTop(container)!)
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })

    Object.defineProperty(table, 'scrollTo', {
      configurable: true,
      value: () => {
        throw new Error('unsupported')
      },
    })
    scrollTo(table, 400)
    fireEvent.click(backTop(container)!)
    expect(table.scrollTop).toBe(0)
  })

  it('uses auto behavior for reduced-motion users', () => {
    vi.stubGlobal('matchMedia', mockMatchMedia(true))
    const { container } = render(() => (
      <IrisTable columns={columns} data={rows} scrollToTop style={fixedStyle} />
    ))
    const table = root(container)
    const scrollToSpy = vi.fn()
    stubScrollTo(table, scrollToSpy)
    scrollTo(table, 400)
    fireEvent.click(backTop(container)!)
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'auto' })
  })

  it('uses the virtual viewport as the effective scroller', () => {
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        scrollToTop
        virtualScroll={{ height: 160, itemHeight: 40 }}
      />
    ))
    const table = root(container)
    const virtual = viewport(container)
    expect(virtual).not.toBeNull()

    // The root is not the effective scroller in virtual mode.
    scrollTo(table, 400)
    expect(backTop(container)).toBeNull()
    scrollTo(virtual!, 400)
    expect(backTop(container)).not.toBeNull()

    const scrollToSpy = vi.fn()
    stubScrollTo(virtual!, scrollToSpy)
    fireEvent.click(backTop(container)!)
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
    expect(table.scrollTop).toBe(400)
  })

  it('re-arms after async rows mount the virtual viewport', () => {
    const [data, setData] = createSignal<Row[]>([])
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={data()}
        scrollToTop
        virtualScroll={{ height: 160, itemHeight: 40 }}
      />
    ))
    expect(viewport(container)).toBeNull()

    setData(rows)
    const virtual = viewport(container)
    expect(virtual).not.toBeNull()
    scrollTo(virtual!, 320)
    expect(backTop(container)).not.toBeNull()
  })

  it('re-arms when loading and error remount the virtual viewport', () => {
    const [phase, setPhase] = createSignal<'ready' | 'loading' | 'error'>('ready')
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        loading={phase() === 'loading'}
        error={phase() === 'error'}
        scrollToTop
        virtualScroll={{ height: 160, itemHeight: 40 }}
      />
    ))

    const first = viewport(container)!
    scrollTo(first, 320)
    expect(backTop(container)).not.toBeNull()

    setPhase('loading')
    expect(viewport(container)).toBeNull()
    setPhase('ready')
    const afterLoading = viewport(container)!
    expect(afterLoading).not.toBe(first)
    scrollTo(afterLoading, 320)
    expect(backTop(container)).not.toBeNull()

    setPhase('error')
    expect(viewport(container)).toBeNull()
    setPhase('ready')
    const afterError = viewport(container)!
    expect(afterError).not.toBe(afterLoading)
    scrollTo(afterError, 320)
    expect(backTop(container)).not.toBeNull()
  })

  it('removes listeners when disabled and when unmounted', () => {
    const [enabled, setEnabled] = createSignal(true)
    const rendered = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        scrollToTop={enabled()}
        virtualScroll={{ height: 160, itemHeight: 40 }}
      />
    ))
    const virtual = viewport(rendered.container)!
    scrollTo(virtual, 320)
    expect(backTop(rendered.container)).not.toBeNull()
    const removeScroll = vi.spyOn(virtual, 'removeEventListener')

    setEnabled(false)
    expect(removeScroll).toHaveBeenCalledWith('scroll', expect.any(Function))
    expect(backTop(rendered.container)).toBeNull()
    scrollTo(virtual, 500)
    expect(backTop(rendered.container)).toBeNull()

    setEnabled(true)
    const remounted = viewport(rendered.container)!
    const removeRemounted = vi.spyOn(remounted, 'removeEventListener')
    rendered.unmount()
    expect(removeRemounted).toHaveBeenCalledWith('scroll', expect.any(Function))
  })

  it('suppresses the control in printable mode and restores it when enabled', () => {
    const [printable, setPrintable] = createSignal(true)
    const { container } = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        scrollToTop
        printable={printable()}
        style={fixedStyle}
      />
    ))
    const table = root(container)
    scrollTo(table, 400)
    expect(backTop(container)).toBeNull()

    setPrintable(false)
    expect(backTop(container)).not.toBeNull()
    const anchor = container.querySelector('[data-iris-back-top-anchor]') as HTMLElement
    const button = backTop(container) as HTMLElement
    expect(anchor.style.position).toBe('sticky')
    expect(anchor.style.height).toBe('0px')
    expect(anchor.style.pointerEvents).toBe('none')
    expect(button.style.insetInlineEnd).toBe('24px')
    expect(button.style.insetBlockEnd).toBe('24px')
    expect(button.style.background).toBe('var(--iris-surface, var(--iris-background))')
    expect(button.style.color).toBe('var(--iris-foreground)')
    expect(button.style.boxShadow).toBe('var(--iris-shadow-md)')
  })
})
