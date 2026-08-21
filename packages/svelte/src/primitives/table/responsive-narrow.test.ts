import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/svelte'
import IrisTable from './IrisTable.svelte'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  MockResizeObserver.instance = null
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: 0,
  })
})

const columns = [
  { key: 'a', title: 'A', width: 100 },
  { key: 'b', title: 'B', width: 100 },
  { key: 'c', title: 'C', width: 100 },
  { key: 'd', title: 'D', width: 100 },
  { key: 'e', title: 'E', width: 100 },
]
const data = [{ id: 1, a: 'A', b: 'B', c: 'C', d: 'D', e: 'E' }]
let measuredWidth = 0

class MockResizeObserver {
  observe = vi.fn()
  disconnect = vi.fn()
  constructor(private readonly callback: ResizeObserverCallback) {
    MockResizeObserver.instance = this
  }
  static instance: MockResizeObserver | null = null
  fire(): void {
    this.callback([], this as unknown as ResizeObserver)
  }
}

function headerKeys(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[data-iris-table-header]'))
    .map((node) => node.getAttribute('data-iris-table-header'))
    .filter((key): key is string => Boolean(key) && !key.startsWith('__'))
}

describe('Svelte IrisTable responsive narrow mode', () => {
  it('hides the tail below 480px and restores it at the threshold', async () => {
    measuredWidth = 479
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => measuredWidth,
    })
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    const view = render(IrisTable, { props: { columns, data, responsive: true } })

    expect(headerKeys(view.container)).toEqual(['a', 'b', 'c', 'd'])
    measuredWidth = 480
    MockResizeObserver.instance?.fire()
    await waitFor(() => expect(headerKeys(view.container)).toEqual(['a', 'b', 'c', 'd', 'e']))
  })

  it('keeps a pinned column and exposes an overflow hint when it still exceeds the width', async () => {
    measuredWidth = 250
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => measuredWidth,
    })
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    const view = render(IrisTable, {
      props: {
        columns: [
          { key: 'a', title: 'A', width: 300, pinned: 'left' },
          { key: 'b', title: 'B', width: 300 },
          { key: 'c', title: 'C', width: 300 },
        ],
        data,
        responsive: true,
      },
    })

    await waitFor(() => expect(headerKeys(view.container)).toEqual(['a', 'b']))
    expect(headerKeys(view.container)).toEqual(['a', 'b'])
    expect(view.container.querySelector('[data-iris-scroll-hint]')).not.toBeNull()
    expect((view.container.querySelector('[data-iris-table]') as HTMLElement).style.overflowX).toBe(
      'auto',
    )
  })
})
