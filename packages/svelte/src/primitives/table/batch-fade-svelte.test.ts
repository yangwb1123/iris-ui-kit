import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/svelte'
import { tick } from 'svelte'
import IrisTable from './IrisTable.svelte'
import type { IrisTableColumn } from './types'
import type { IrisTableProps } from './props'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
  status: string
}

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 25, status: 'active' },
  { id: 2, name: 'Bob', age: 32, status: 'paused' },
]
const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 100 },
  { key: 'age', title: 'Age', width: 120 },
  { key: 'status', title: 'Status', width: 80 },
]

function installAnimationFrameStub(): void {
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) =>
    window.setTimeout(() => callback(0), 16),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
}

async function flush(): Promise<void> {
  await tick()
  await Promise.resolve()
  await tick()
}

async function stepFrames(count = 2): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    vi.advanceTimersByTime(16)
    await flush()
  }
}

async function commitFade(): Promise<void> {
  vi.advanceTimersByTime(200)
  await flush()
}

function root(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-table]') as HTMLElement
}

function cell(container: HTMLElement, id: number, key: string): HTMLElement | null {
  return container.querySelector(
    `[data-iris-table-row-key="${id}"] [data-iris-table-cell="${key}"]`,
  )
}

function header(container: HTMLElement, key: string): HTMLElement | null {
  return container.querySelector(`[data-iris-table-header="${key}"]`)
}

function template(container: HTMLElement): string {
  return (container.querySelector('[data-iris-table-row-key="1"]') as HTMLElement).style
    .gridTemplateColumns
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.getElementById('iris-table-column-fade-styles-svelte')?.remove()
})

describe('Svelte IrisTable columnFade', () => {
  it('is default-off and does not install a motion listener or overlay', async () => {
    vi.useFakeTimers()
    const matchMedia = vi.fn()
    vi.stubGlobal('matchMedia', matchMedia)
    const view = render(IrisTable, { props: { columns, data: rows, rowKey: 'id' } })
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: false },
    })
    expect(cell(view.container, 1, 'age')).toBeNull()
    expect(root(view.container).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(view.container.querySelector('[data-iris-column-fade]')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
    expect(matchMedia).not.toHaveBeenCalled()
    expect(document.getElementById('iris-table-column-fade-styles-svelte')).toBeNull()
  })

  it('accepts the additive prop and does not animate a column hidden at mount', () => {
    const contract: IrisTableProps = { columns, columnFade: true }
    expect(contract.columnFade).toBe(true)
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnVisibility: { age: false },
        columnFade: true,
      },
    })
    expect(cell(view.container, 1, 'age')).toBeNull()
    expect(view.container.querySelector('[data-iris-column-fade]')).toBeNull()
    expect(template(view.container)).toBe('100px 80px')
  })

  it('animates the first controlled update from an undefined visibility map', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const view = render(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', columnFade: true },
    })
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
    })
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    await stepFrames()
    expect(template(view.container)).toBe('100px 0px 80px')
    await commitFade()
    expect(cell(view.container, 1, 'age')).toBeNull()
  })

  it('animates a post-mount hide through pending, run, and commit', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const view = render(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', columnVisibility: {}, columnFade: true },
    })
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
    })
    const fading = cell(view.container, 1, 'age')!
    expect(fading.getAttribute('data-iris-column-fade')).toBe('out')
    expect(fading.style.opacity).toBe('')
    expect(template(view.container)).toBe('100px 120px 80px')
    expect(root(view.container).getAttribute('data-iris-column-fade-active')).toBe('true')
    await stepFrames()
    expect(cell(view.container, 1, 'age')?.style.opacity).toBe('0')
    expect(cell(view.container, 1, 'age')?.getAttribute('aria-hidden')).toBe('true')
    expect(cell(view.container, 1, 'age')?.hasAttribute('inert')).toBe(true)
    expect(template(view.container)).toBe('100px 0px 80px')
    await commitFade()
    expect(cell(view.container, 1, 'age')).toBeNull()
    expect(root(view.container).getAttribute('data-iris-column-fade-active')).toBeNull()
  })

  it('animates a show from a collapsed track and restores settled markup', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const view = render(IrisTable, {
      props: {
        columns,
        data: rows,
        rowKey: 'id',
        columnVisibility: { age: false },
        columnFade: true,
      },
    })
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: true },
      columnFade: true,
    })
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('in')
    expect(cell(view.container, 1, 'age')?.style.opacity).toBe('0')
    expect(template(view.container)).toBe('100px 0px 80px')
    await stepFrames()
    expect(cell(view.container, 1, 'age')?.style.opacity).toBe('')
    expect(template(view.container)).toBe('100px 120px 80px')
    await commitFade()
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('rebases both directions during a transition and leaves no schedules', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const view = render(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', columnVisibility: {}, columnFade: true },
    })
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
    })
    await stepFrames()
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: true },
      columnFade: true,
    })
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('in')
    await stepFrames()
    await commitFade()
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBeNull()

    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
    })
    await stepFrames()
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: true },
      columnFade: true,
    })
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('in')
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
    })
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    await commitFade()
    expect(cell(view.container, 1, 'age')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('commits multiple columns in one window and preserves fallback tracks', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const noWidths = columns.map(({ width: _width, ...column }) => column)
    const view = render(IrisTable, {
      props: { columns: noWidths, data: rows, columnVisibility: {}, columnFade: true },
    })
    await view.rerender({
      columns: noWidths,
      data: rows,
      columnVisibility: { name: false, age: false },
      columnFade: true,
    })
    expect(view.container.querySelectorAll('[data-iris-column-fade="out"]')).toHaveLength(6)
    await stepFrames()
    expect(template(view.container)).toBe('0px 0px minmax(0, 1fr)')
    await commitFade()
    expect(view.container.querySelector('[data-iris-column-fade]')).toBeNull()
    expect(template(view.container)).toBe('minmax(0, 1fr)')
  })

  it('fans grouped top-level fades to leaves but ignores leaf-only keys', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const grouped: IrisTableColumn<Row>[] = [
      {
        key: 'personal',
        title: 'Personal',
        children: [
          { key: 'name', title: 'Name', width: 100 },
          { key: 'age', title: 'Age', width: 120 },
        ],
      },
      { key: 'status', title: 'Status', width: 80 },
    ]
    const view = render(IrisTable, {
      props: { columns: grouped, data: rows, columnVisibility: {}, columnFade: true },
    })
    await view.rerender({
      columns: grouped,
      data: rows,
      columnVisibility: { name: false },
      columnFade: true,
    })
    expect(header(view.container, 'personal')).not.toBeNull()
    expect(cell(view.container, 1, 'name')?.getAttribute('data-iris-column-fade')).toBeNull()
    expect(root(view.container).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)

    await view.rerender({
      columns: grouped,
      data: rows,
      columnVisibility: { personal: false },
      columnFade: true,
    })
    expect(header(view.container, 'personal')?.getAttribute('data-iris-column-fade')).toBe('out')
    expect(cell(view.container, 1, 'name')?.getAttribute('data-iris-column-fade')).toBe('out')
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    await stepFrames()
    expect(template(view.container)).toBe('0px 0px 80px')
    await commitFade()
    expect(cell(view.container, 1, 'name')).toBeNull()
  })

  it('keeps summary cells on the same collapsing track', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const summaryColumns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', width: 100 },
      { key: 'age', title: 'Age', width: 120, summary: 'sum' },
      { key: 'status', title: 'Status', width: 80 },
    ]
    const view = render(IrisTable, {
      props: { columns: summaryColumns, data: rows, columnVisibility: {}, columnFade: true },
    })
    await view.rerender({
      columns: summaryColumns,
      data: rows,
      columnVisibility: { age: false },
      columnFade: true,
    })
    expect(
      view.container.querySelector('[data-iris-table-row="summary"] [data-iris-column-fade="out"]'),
    ).not.toBeNull()
    await stepFrames()
    expect(
      (view.container.querySelector('[data-iris-table-row="summary"]') as HTMLElement).style
        .gridTemplateColumns,
    ).toBe('100px 0px 80px')
  })

  it('re-arms a fading column outside the horizontal virtual window', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const virtualColumns: IrisTableColumn<Row>[] = [
      ...columns,
      { key: 'extra1', title: 'Extra 1', width: 80 },
      { key: 'extra2', title: 'Extra 2', width: 80 },
      { key: 'tail', title: 'Tail', width: 80 },
    ]
    const view = render(IrisTable, {
      props: {
        columns: virtualColumns,
        data: rows,
        rowKey: 'id',
        columnVirtualization: true,
        columnVisibility: {},
        columnFade: true,
      },
    })
    expect(cell(view.container, 1, 'tail')).toBeNull()
    await view.rerender({
      columns: virtualColumns,
      data: rows,
      rowKey: 'id',
      columnVirtualization: true,
      columnVisibility: { tail: false },
      columnFade: true,
    })
    expect(cell(view.container, 1, 'tail')).not.toBeNull()
    expect(cell(view.container, 1, 'tail')?.style.gridColumnStart).toBe('6')
    await stepFrames()
    expect(cell(view.container, 1, 'tail')?.style.opacity).toBe('0')
    await commitFade()
    expect(cell(view.container, 1, 'tail')).toBeNull()
  })

  it('skips all scheduling when reduced motion is already active', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    vi.stubGlobal(
      'matchMedia',
      () =>
        ({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    )
    const view = render(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', columnVisibility: {}, columnFade: true },
    })
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
    })
    expect(cell(view.container, 1, 'age')).toBeNull()
    expect(root(view.container).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('skips scheduling under reduced motion and cancels an active fade when it changes', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const media: { matches: boolean; listener?: () => void } = { matches: false }
    vi.stubGlobal(
      'matchMedia',
      () =>
        ({
          get matches() {
            return media.matches
          },
          addEventListener: (_type: string, listener: () => void) => {
            media.listener = listener
          },
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList,
    )
    const view = render(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', columnVisibility: {}, columnFade: true },
    })
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
    })
    expect(cell(view.container, 1, 'age')).not.toBeNull()
    expect(vi.getTimerCount()).toBe(2)

    media.matches = true
    media.listener?.()
    await flush()
    expect(cell(view.container, 1, 'age')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignores stale frames when animation cancellation is unavailable', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) =>
      window.setTimeout(() => callback(0), 16),
    )
    vi.stubGlobal('cancelAnimationFrame', undefined)
    const view = render(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', columnVisibility: {}, columnFade: true },
    })
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
    })
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: false,
    })
    vi.advanceTimersByTime(32)
    await flush()
    expect(cell(view.container, 1, 'age')).toBeNull()
    expect(root(view.container).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cleans pending work on unmount', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const view = render(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', columnVisibility: {}, columnFade: true },
    })
    await view.rerender({
      columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: { age: false },
      columnFade: true,
    })
    expect(vi.getTimerCount()).toBe(2)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
