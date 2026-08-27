import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { IrisTable } from './IrisTable'
import type { IrisTableProps } from './props'
import type { IrisTableColumn } from './types'

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 25 },
  { id: 2, name: 'Bob', age: 32 },
]
const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', width: 100 },
  { key: 'age', title: 'Age', width: 120 },
]

function installAnimationFrameStub(): void {
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) =>
    window.setTimeout(() => callback(0), 16),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

async function runFrames(): Promise<void> {
  vi.advanceTimersByTime(16)
  await flush()
  vi.advanceTimersByTime(16)
  await flush()
}

function root(container: HTMLElement): HTMLElement {
  return container.querySelector('[data-iris-table]') as HTMLElement
}

function cell(container: HTMLElement, row: number, key: string): HTMLElement | null {
  return container.querySelector(
    `[data-iris-table-row-key="${row}"] [data-iris-table-cell="${key}"]`,
  )
}

function header(container: HTMLElement, key: string): HTMLElement | null {
  return container.querySelector(`[data-iris-table-header="${key}"]`)
}

function template(container: HTMLElement): string {
  return (cell(container, 1, 'name')?.parentElement as HTMLElement).style.gridTemplateColumns
}

function table(options: Partial<IrisTableProps<Row>> = {}) {
  return render(() => (
    <IrisTable columns={columns} data={rows} rowKey="id" columnFade {...options} />
  ))
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('Solid IrisTable columnFade (Grid Core continuation)', () => {
  it('is additive, default-off, and never emits visibility changes', async () => {
    vi.useFakeTimers()
    const matchMedia = vi.fn()
    vi.stubGlobal('matchMedia', matchMedia)
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({})
    const onVisibilityChange = vi.fn()
    const view = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        onColumnVisibilityChange={onVisibilityChange}
      />
    ))
    setVisibility({ age: false })
    await flush()
    expect(cell(view.container, 1, 'age')).toBeNull()
    expect(root(view.container).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(view.container.querySelector('[data-iris-column-fade]')).toBeNull()
    expect(document.getElementById('iris-table-column-fade-styles-solid')).toBeNull()
    expect(matchMedia).not.toHaveBeenCalled()
    expect(onVisibilityChange).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('keeps Solid fade CSS independent from a shared adapter stylesheet', () => {
    document.getElementById('iris-table-row-styles')?.remove()
    document.getElementById('iris-table-column-fade-styles-solid')?.remove()
    const foreign = document.createElement('style')
    foreign.id = 'iris-table-row-styles'
    foreign.textContent = '/* another adapter */'
    document.head.appendChild(foreign)
    table()
    expect(document.getElementById('iris-table-row-styles')).toBe(foreign)
    expect(document.getElementById('iris-table-column-fade-styles-solid')).not.toBeNull()
  })

  it('accepts the public prop and keeps an initially hidden column instant', () => {
    const contract: IrisTableProps<Row> = { columns, columnFade: true }
    expect(contract.columnFade).toBe(true)
    const view = table({ columnVisibility: { age: false } })
    expect(cell(view.container, 1, 'age')).toBeNull()
    expect(view.container.querySelector('[data-iris-column-fade]')).toBeNull()
    expect(template(view.container)).toBe('100px')
  })

  it('animates an undefined-to-hidden replacement through the Grid Core bridge', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const [visibility, setVisibility] = createSignal<Record<string, boolean> | undefined>(undefined)
    const view = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
      />
    ))
    setVisibility({ age: false })
    await flush()
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    expect(template(view.container)).toBe('100px 120px')
    await runFrames()
    expect(template(view.container)).toBe('100px 0px')
    vi.advanceTimersByTime(200)
    await flush()
    expect(cell(view.container, 1, 'age')).toBeNull()
  })

  it('animates hide, commits it, and preserves the settled track template', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({})
    const view = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
      />
    ))
    setVisibility({ age: false })
    await flush()
    expect(cell(view.container, 1, 'age')?.style.opacity).toBe('')
    expect(root(view.container).getAttribute('data-iris-column-fade-active')).toBe('true')
    await runFrames()
    expect(cell(view.container, 1, 'age')?.style.opacity).toBe('0')
    expect(header(view.container, 'age')?.style.opacity).toBe('0')
    expect(template(view.container)).toBe('100px 0px')
    vi.advanceTimersByTime(200)
    await flush()
    expect(cell(view.container, 1, 'age')).toBeNull()
    expect(root(view.container).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(template(view.container)).toBe('100px')
  })

  it('animates a show from a collapsed track and restores it', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({ age: false })
    const view = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
      />
    ))
    setVisibility({ age: true })
    await flush()
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('in')
    expect(cell(view.container, 1, 'age')?.style.opacity).toBe('0')
    expect(template(view.container)).toBe('100px 0px')
    await runFrames()
    expect(cell(view.container, 1, 'age')?.style.opacity).toBe('')
    expect(template(view.container)).toBe('100px 120px')
    vi.advanceTimersByTime(200)
    await flush()
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('reverses hide-to-show and show-to-hide without committing the stale direction', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({})
    const view = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
      />
    ))
    setVisibility({ age: false })
    await flush()
    await runFrames()
    setVisibility({ age: true })
    await flush()
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('in')
    expect(template(view.container)).toBe('100px 0px')
    await runFrames()
    vi.advanceTimersByTime(200)
    await flush()
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBeNull()

    setVisibility({ age: false })
    await flush()
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    await runFrames()
    expect(template(view.container)).toBe('100px 0px')
    vi.advanceTimersByTime(200)
    await flush()
    expect(cell(view.container, 1, 'age')).toBeNull()
  })

  it('maps a grouped top-level fade to every leaf header, cell, and track', async () => {
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
      { key: 'extra', title: 'Extra', width: 80 },
    ]
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({})
    const view = render(() => (
      <IrisTable
        columns={grouped}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
      />
    ))
    setVisibility({ personal: false })
    await flush()
    expect(header(view.container, 'personal')?.getAttribute('data-iris-column-fade')).toBe('out')
    expect(cell(view.container, 1, 'name')?.getAttribute('data-iris-column-fade')).toBe('out')
    expect(cell(view.container, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    await runFrames()
    expect(template(view.container)).toBe('0px 0px 80px')
  })

  it('keeps a fading far column mounted in the virtualized window', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const wideColumns: IrisTableColumn<Row>[] = Array.from({ length: 8 }, (_, index) => ({
      key: `c${index}`,
      title: `C${index}`,
      width: 120,
    }))
    const wideRows: Row[] = [
      {
        id: 1,
        name: '',
        age: 0,
        ...Object.fromEntries(wideColumns.map((col) => [col.key, col.key])),
      },
    ]
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({})
    const view = render(() => (
      <IrisTable
        columns={wideColumns}
        data={wideRows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
        columnVirtualization
      />
    ))
    expect(view.container.querySelector('[data-iris-table-header="c7"]')).toBeNull()
    setVisibility({ c7: false })
    await flush()
    expect(view.container.querySelector('[data-iris-table-header="c7"]')).not.toBeNull()
    expect(
      view.container
        .querySelector('[data-iris-table-header="c7"]')
        ?.getAttribute('data-iris-column-fade'),
    ).toBe('out')
    await runFrames()
    expect(
      (view.container.querySelector('[data-iris-table-row-key="1"]') as HTMLElement).style
        .gridTemplateColumns,
    ).toContain('0px')
  })

  it('applies the overlay to summary cells without changing aggregate values', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const summaryColumns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', width: 100 },
      { key: 'age', title: 'Age', width: 120, summary: 'sum' },
    ]
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({})
    const view = render(() => (
      <IrisTable
        columns={summaryColumns}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
      />
    ))
    setVisibility({ age: false })
    await flush()
    const summary = view.container.querySelector('[data-iris-table-row="summary"]')!
    expect(summary.querySelector('[data-iris-column-fade="out"]')).not.toBeNull()
    expect(summary.querySelector('[data-iris-table-cell="age"]')?.textContent).toBe('57')
    await runFrames()
    expect(
      (summary.querySelector('[data-iris-table-cell="age"]') as HTMLElement).style.opacity,
    ).toBe('0')
    expect((summary as HTMLElement).style.gridTemplateColumns).toBe('100px 0px')
  })

  it('keeps non-numeric authored tracks fail-closed while collapsing', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const noWidths: IrisTableColumn<Row>[] = columns.map(({ width: _width, ...column }) => column)
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({})
    const view = render(() => (
      <IrisTable
        columns={noWidths}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
      />
    ))
    setVisibility({ age: false })
    await flush()
    await runFrames()
    expect(template(view.container)).toBe('minmax(0, 1fr) 0px')
  })

  it('uses token-backed transitions and disables the JS machine for reduced motion', async () => {
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
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({})
    const view = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
      />
    ))
    const css = document.getElementById('iris-table-column-fade-styles-solid')?.textContent ?? ''
    expect(css).toContain('transition: opacity var(--iris-duration-md, 200ms) ease;')
    expect(css).toContain('transition: grid-template-columns var(--iris-duration-md, 200ms) ease;')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    setVisibility({ age: false })
    await flush()
    expect(cell(view.container, 1, 'age')).toBeNull()
    expect(view.container.querySelector('[data-iris-column-fade]')).toBeNull()
    expect(root(view.container).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('moves focus from an inert fading cell to the nearest visible cell', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({})
    const view = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
        keyboardNavigation
      />
    ))
    const fading = cell(view.container, 1, 'age')!
    fading.focus()
    expect(document.activeElement).toBe(fading)
    setVisibility({ age: false })
    await flush()
    await runFrames()
    const fadedNow = cell(view.container, 1, 'age')!
    expect(fadedNow.getAttribute('aria-hidden')).toBe('true')
    expect(
      fadedNow.hasAttribute('inert') || (fadedNow as HTMLElement & { inert?: boolean }).inert,
    ).toBe(true)
    expect(document.activeElement).toBe(cell(view.container, 1, 'name'))
  })

  it('does not steal focus after the user leaves the table during a fade', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({})
    const view = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
        keyboardNavigation
      />
    ))
    ;(cell(view.container, 1, 'age') as HTMLElement).focus()
    setVisibility({ age: false })
    await flush()
    const outside = document.body.appendChild(document.createElement('button'))
    outside.focus()
    await runFrames()
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })

  it('cancels timers and animation frames on unmount', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const [visibility, setVisibility] = createSignal<Record<string, boolean>>({})
    const view = render(() => (
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={visibility()}
        columnFade
      />
    ))
    setVisibility({ age: false })
    await flush()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    view.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
