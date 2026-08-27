import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

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

function fadeApp(
  visibility: Record<string, boolean> | undefined,
  options: {
    columns?: IrisTableColumn<Row>[]
    fade?: boolean
    keyboardNavigation?: boolean
    columnVirtualization?: boolean
    attachTo?: Element
  } = {},
) {
  return mount(IrisTable, {
    attachTo: options.attachTo,
    props: {
      columns: options.columns ?? columns,
      data: rows,
      rowKey: 'id',
      columnVisibility: visibility,
      columnFade: options.fade ?? true,
      keyboardNavigation: options.keyboardNavigation,
      columnVirtualization: options.columnVirtualization,
    },
  })
}

function rootEl(wrapper: ReturnType<typeof mount>): HTMLElement {
  return wrapper.find('[data-iris-table]').element as HTMLElement
}

function bodyRow(wrapper: ReturnType<typeof mount>, key: string | number = 1): HTMLElement {
  return wrapper.find(`[data-iris-table-row-key="${key}"]`).element as HTMLElement
}

function bodyCell(
  wrapper: ReturnType<typeof mount>,
  row: string | number,
  key: string,
): HTMLElement | null {
  const cell = wrapper.find(`[data-iris-table-row-key="${row}"] [data-iris-table-cell="${key}"]`)
  return cell.exists() ? (cell.element as HTMLElement) : null
}

function headerCell(wrapper: ReturnType<typeof mount>, key: string): HTMLElement | null {
  const cell = wrapper.find(`[data-iris-table-header="${key}"]`)
  return cell.exists() ? (cell.element as HTMLElement) : null
}

function summaryCell(wrapper: ReturnType<typeof mount>, key: string): HTMLElement | null {
  const cell = wrapper.find(`[data-iris-table-row="summary"] [data-iris-table-cell="${key}"]`)
  return cell.exists() ? (cell.element as HTMLElement) : null
}

function rowTemplate(wrapper: ReturnType<typeof mount>): string {
  return bodyRow(wrapper).style.gridTemplateColumns
}

function installAnimationFrameStub(): void {
  vi.stubGlobal('requestAnimationFrame', (callback: (time: number) => void) =>
    window.setTimeout(() => callback(0), 16),
  )
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
}

async function stepFrames(count = 2): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    vi.advanceTimersByTime(16)
    await nextTick()
  }
}

async function commitFade(): Promise<void> {
  vi.advanceTimersByTime(200)
  await nextTick()
}

describe('IrisTable columnFade (Vue Grid Core continuation)', () => {
  it('is default-off and leaves the existing visibility path instant', async () => {
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', columnVisibility: {} },
    })
    await wrapper.setProps({ columnVisibility: { age: false } })
    expect(rootEl(wrapper).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(wrapper.find('[data-iris-column-fade]').exists()).toBe(false)
    expect(bodyCell(wrapper, 1, 'age')).toBeNull()
    expect(bodyCell(wrapper, 1, 'name')).not.toBeNull()
  })

  it('does not install fade resources until columnFade is enabled', async () => {
    const fadeStyleBefore = document.getElementById('iris-table-column-fade-styles-vue')
    const matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    vi.stubGlobal('matchMedia', matchMedia)
    const wrapper = mount(IrisTable, {
      props: { columns, data: rows, rowKey: 'id', columnVisibility: {} },
    })
    expect(document.getElementById('iris-table-column-fade-styles-vue')).toBe(fadeStyleBefore)
    expect(matchMedia).not.toHaveBeenCalled()

    await wrapper.setProps({ columnFade: true })
    expect(document.getElementById('iris-table-column-fade-styles-vue')).not.toBeNull()
    expect(matchMedia).toHaveBeenCalledTimes(1)
  })

  it('does not animate a column hidden at mount', () => {
    const wrapper = fadeApp({ age: false })
    expect(bodyCell(wrapper, 1, 'age')).toBeNull()
    expect(wrapper.find('[data-iris-column-fade]').exists()).toBe(false)
    expect(rootEl(wrapper).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(rowTemplate(wrapper)).toBe('100px 80px')
  })

  it('animates the first update from an undefined visibility map', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const wrapper = fadeApp(undefined)
    await wrapper.setProps({ columnVisibility: { age: false } })
    expect(bodyCell(wrapper, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    expect(rowTemplate(wrapper)).toBe('100px 120px 80px')
    await stepFrames()
    expect(bodyCell(wrapper, 1, 'age')?.style.opacity).toBe('0')
    expect(rowTemplate(wrapper)).toBe('100px 0px 80px')
    await commitFade()
    expect(bodyCell(wrapper, 1, 'age')).toBeNull()
  })

  it('hides in pending → run → commit phases and restores settled markup', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const wrapper = fadeApp({})
    await wrapper.setProps({ columnVisibility: { age: false } })
    const cell = bodyCell(wrapper, 1, 'age')!
    expect(rootEl(wrapper).getAttribute('data-iris-column-fade-active')).toBe('true')
    expect(cell.getAttribute('data-iris-column-fade')).toBe('out')
    expect(cell.style.opacity).toBe('')
    await stepFrames()
    expect(cell.style.opacity).toBe('0')
    expect(rowTemplate(wrapper)).toBe('100px 0px 80px')
    await commitFade()
    expect(bodyCell(wrapper, 1, 'age')).toBeNull()
    expect(rootEl(wrapper).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(wrapper.find('[data-iris-column-fade]').exists()).toBe(false)
    expect(rowTemplate(wrapper)).toBe('100px 80px')
  })

  it('shows in pending → run → commit phases', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const wrapper = fadeApp({ age: false })
    await wrapper.setProps({ columnVisibility: { age: true } })
    const cell = bodyCell(wrapper, 1, 'age')!
    expect(cell.getAttribute('data-iris-column-fade')).toBe('in')
    expect(cell.style.opacity).toBe('0')
    expect(rowTemplate(wrapper)).toBe('100px 0px 80px')
    await stepFrames()
    expect(cell.style.opacity).toBe('')
    expect(rowTemplate(wrapper)).toBe('100px 120px 80px')
    await commitFade()
    expect(cell.getAttribute('data-iris-column-fade')).toBeNull()
    expect(rootEl(wrapper).getAttribute('data-iris-column-fade-active')).toBeNull()
  })

  it('commits multiple changed columns in one window', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const wrapper = fadeApp({})
    await wrapper.setProps({ columnVisibility: { name: false, age: false } })
    expect(bodyCell(wrapper, 1, 'name')?.getAttribute('data-iris-column-fade')).toBe('out')
    expect(bodyCell(wrapper, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    await stepFrames()
    expect(rowTemplate(wrapper)).toBe('0px 0px 80px')
    await commitFade()
    expect(bodyCell(wrapper, 1, 'name')).toBeNull()
    expect(bodyCell(wrapper, 1, 'age')).toBeNull()
    expect(rowTemplate(wrapper)).toBe('80px')
  })

  it('restarts both hide → show and show → hide reversals', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const hideShow = fadeApp({})
    await hideShow.setProps({ columnVisibility: { age: false } })
    await stepFrames()
    await hideShow.setProps({ columnVisibility: { age: true } })
    expect(bodyCell(hideShow, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('in')
    expect(rowTemplate(hideShow)).toBe('100px 0px 80px')
    await stepFrames()
    await commitFade()
    expect(bodyCell(hideShow, 1, 'age')?.getAttribute('data-iris-column-fade')).toBeNull()

    const showHide = fadeApp({ age: false })
    await showHide.setProps({ columnVisibility: { age: true } })
    await stepFrames()
    await showHide.setProps({ columnVisibility: { age: false } })
    expect(bodyCell(showHide, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    await stepFrames()
    await commitFade()
    expect(bodyCell(showHide, 1, 'age')).toBeNull()
  })

  it('keeps non-numeric widths on the existing fallback while collapsing to zero', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const fallbackColumns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age' },
    ]
    const wrapper = fadeApp({}, { columns: fallbackColumns })
    await wrapper.setProps({ columnVisibility: { age: false } })
    await stepFrames()
    expect(bodyCell(wrapper, 1, 'age')?.style.opacity).toBe('0')
    expect(rowTemplate(wrapper)).toBe('140px 0px')
    await commitFade()
    expect(bodyCell(wrapper, 1, 'age')).toBeNull()
    expect(rowTemplate(wrapper)).toBe('140px')
  })

  it('applies the fade surface to flat header and summary cells', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const summaryColumns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', width: 100 },
      { key: 'age', title: 'Age', width: 120, summary: 'sum' },
      { key: 'status', title: 'Status', width: 80 },
    ]
    const wrapper = fadeApp({}, { columns: summaryColumns })
    await wrapper.setProps({ columnVisibility: { age: false } })
    expect(headerCell(wrapper, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    expect(summaryCell(wrapper, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    await stepFrames()
    expect(headerCell(wrapper, 'age')?.style.opacity).toBe('0')
    expect(summaryCell(wrapper, 'age')?.style.opacity).toBe('0')
    await commitFade()
    expect(headerCell(wrapper, 'age')).toBeNull()
    expect(wrapper.find('[data-iris-table-row="summary"]').exists()).toBe(false)
  })

  it('fans a grouped top-level fade out to all leaf tracks and cells', async () => {
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
    const wrapper = fadeApp({}, { columns: grouped })
    await wrapper.setProps({ columnVisibility: { personal: false } })
    expect(headerCell(wrapper, 'personal')?.getAttribute('data-iris-column-fade')).toBe('out')
    expect(bodyCell(wrapper, 1, 'name')?.getAttribute('data-iris-column-fade')).toBe('out')
    expect(bodyCell(wrapper, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('out')
    await stepFrames()
    expect(rowTemplate(wrapper)).toBe('0px 0px 80px')
    await commitFade()
    expect(bodyCell(wrapper, 1, 'name')).toBeNull()
    expect(bodyCell(wrapper, 1, 'age')).toBeNull()
    expect(bodyCell(wrapper, 1, 'status')).not.toBeNull()
    expect(rowTemplate(wrapper)).toBe('80px')
  })

  it('does not turn a grouped leaf-only visibility key into a new behavior', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const grouped: IrisTableColumn<Row>[] = [
      {
        key: 'personal',
        title: 'Personal',
        children: [{ key: 'name', title: 'Name', width: 100 }],
      },
      { key: 'status', title: 'Status', width: 80 },
    ]
    const wrapper = fadeApp({}, { columns: grouped })
    await wrapper.setProps({ columnVisibility: { name: false } })
    expect(headerCell(wrapper, 'personal')).not.toBeNull()
    expect(bodyCell(wrapper, 1, 'name')?.getAttribute('data-iris-column-fade')).toBeNull()
    expect(rootEl(wrapper).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('includes a fading column outside the horizontal virtual window', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const virtualColumns: IrisTableColumn<Row>[] = [
      ...columns,
      { key: 'extra1', title: 'Extra 1', width: 80 },
      { key: 'extra2', title: 'Extra 2', width: 80 },
      { key: 'tail', title: 'Tail', width: 80 },
    ]
    const wrapper = fadeApp({}, { columns: virtualColumns, columnVirtualization: true })
    expect(bodyCell(wrapper, 1, 'tail')).toBeNull()
    await wrapper.setProps({ columnVisibility: { tail: false } })
    const cell = bodyCell(wrapper, 1, 'tail')!
    expect(cell).not.toBeNull()
    expect(cell.style.gridColumnStart).toBe('6')
    await stepFrames()
    expect(cell.style.opacity).toBe('0')
    await commitFade()
    expect(bodyCell(wrapper, 1, 'tail')).toBeNull()
  })

  it('moves focus from a collapsed interactive cell and marks it inert', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const wrapper = fadeApp({}, { keyboardNavigation: true, attachTo: document.body })
    const fadingCell = bodyCell(wrapper, 1, 'age')!
    fadingCell.focus()
    expect(document.activeElement).toBe(fadingCell)
    await wrapper.setProps({ columnVisibility: { age: false } })
    await stepFrames()
    expect(fadingCell.getAttribute('aria-hidden')).toBe('true')
    expect(fadingCell.hasAttribute('inert')).toBe(true)
    expect(document.activeElement).toBe(bodyCell(wrapper, 1, 'name'))
    await commitFade()
  })

  it('blurs a fading cell when its row has no focus candidate', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const oneColumn: IrisTableColumn<Row>[] = [{ key: 'age', title: 'Age', width: 120 }]
    const wrapper = fadeApp(
      {},
      { columns: oneColumn, keyboardNavigation: true, attachTo: document.body },
    )
    const fadingCell = bodyCell(wrapper, 1, 'age')!
    fadingCell.focus()
    await wrapper.setProps({ columnVisibility: { age: false } })
    await stepFrames()
    expect(document.activeElement).not.toBe(fadingCell)
    await commitFade()
  })

  it('skips the machine and all scheduling for reduced-motion users', async () => {
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
    const wrapper = fadeApp({})
    await wrapper.setProps({ columnVisibility: { age: false } })
    expect(bodyCell(wrapper, 1, 'age')).toBeNull()
    expect(wrapper.find('[data-iris-column-fade]').exists()).toBe(false)
    expect(rootEl(wrapper).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels an in-flight transition when reduced motion becomes active', async () => {
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
    const wrapper = fadeApp({})
    await wrapper.setProps({ columnVisibility: { age: false } })
    expect(bodyCell(wrapper, 1, 'age')).not.toBeNull()
    media.matches = true
    media.listener?.()
    await nextTick()
    expect(bodyCell(wrapper, 1, 'age')).toBeNull()
    expect(rootEl(wrapper).getAttribute('data-iris-column-fade-active')).toBeNull()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('injects token-backed transitions with a reduced-motion freeze gate', () => {
    fadeApp({})
    const css = document.getElementById('iris-table-column-fade-styles-vue')?.textContent ?? ''
    expect(css).toContain('transition: opacity var(--iris-duration-md, 200ms) ease;')
    expect(css).toContain('transition: grid-template-columns var(--iris-duration-md, 200ms) ease;')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('transition: none !important;')
    expect(css).not.toContain('transition-duration: 200ms')
  })

  it('cleans the timer and re-bases after a completed transition', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const wrapper = fadeApp({})
    await wrapper.setProps({ columnVisibility: { age: false } })
    await stepFrames()
    expect(vi.getTimerCount()).toBe(1)
    await commitFade()
    expect(vi.getTimerCount()).toBe(0)
    await wrapper.setProps({ columnVisibility: { age: true } })
    expect(bodyCell(wrapper, 1, 'age')?.getAttribute('data-iris-column-fade')).toBe('in')
    await stepFrames()
    await commitFade()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cancels pending work on unmount', async () => {
    vi.useFakeTimers()
    installAnimationFrameStub()
    const wrapper = fadeApp({})
    await wrapper.setProps({ columnVisibility: { age: false } })
    expect(vi.getTimerCount()).toBe(2)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
    vi.advanceTimersByTime(500)
  })
})
