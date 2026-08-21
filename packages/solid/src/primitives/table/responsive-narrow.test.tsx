import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'

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
    .filter((key): key is string => typeof key === 'string' && !key.startsWith('__'))
}

describe('Solid IrisTable responsive narrow mode', () => {
  it('hides the tail below 480px and restores it at the threshold', () => {
    measuredWidth = 479
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => measuredWidth,
    })
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    const { container } = render(() => <IrisTable columns={columns} data={data} responsive />)

    expect(headerKeys(container)).toEqual(['a', 'b', 'c', 'd'])
    measuredWidth = 480
    MockResizeObserver.instance?.fire()
    expect(headerKeys(container)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('keeps a pinned column and exposes an overflow hint when it still exceeds the width', () => {
    measuredWidth = 250
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => measuredWidth,
    })
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    const { container } = render(() => (
      <IrisTable
        columns={[
          { key: 'a', title: 'A', width: 300, pinned: 'left' },
          { key: 'b', title: 'B', width: 300 },
          { key: 'c', title: 'C', width: 300 },
        ]}
        data={data}
        responsive
      />
    ))

    expect(headerKeys(container)).toEqual(['a', 'b'])
    expect(container.querySelector('[data-iris-scroll-hint]')).not.toBeNull()
    expect((container.querySelector('[data-iris-table]') as HTMLElement).style.overflowX).toBe(
      'auto',
    )
  })
})
