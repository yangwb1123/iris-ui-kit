import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@solidjs/testing-library'
import { IrisTable } from './IrisTable'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

describe('IrisTable virtual scroll', () => {
  interface VRow extends Record<string, unknown> {
    id: number
    name: string
    children?: VRow[]
  }
  const vcols: IrisTableColumn<VRow>[] = [{ key: 'name', title: 'Name' }]
  const rowEls = (): Element[] => Array.from(document.querySelectorAll('[data-iris-table-row=""]'))

  it('renders the body inside a virtual scroller that windows the rows', () => {
    const many: VRow[] = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `N${i}` }))
    render(() => (
      <IrisTable columns={vcols} data={many} virtualScroll={{ itemHeight: 36, height: 200 }} />
    ))
    expect(document.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
    const count = rowEls().length
    expect(count).toBeGreaterThan(0)
    expect(count).toBeLessThan(50)
  })

  it('virtualizes tree mode (uniform-height rows) with tree decoration intact', () => {
    const tree: VRow[] = [
      {
        id: 1,
        name: 'Root',
        children: Array.from({ length: 40 }, (_, i) => ({ id: 100 + i, name: `C${i}` })),
      },
    ]
    render(() => (
      <IrisTable
        columns={vcols}
        data={tree}
        getSubRows={(r) => r.children}
        defaultExpandedRowKeys={[1]}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />
    ))
    // Tree mode now uses the virtual scroller (was previously excluded).
    expect(document.querySelector('[data-iris-virtual-scroll]')).not.toBeNull()
    // Tree meta still flows into the virtualized rows (the parent toggle renders).
    expect(document.querySelector('[data-iris-table-tree-toggle]')).not.toBeNull()
    // Windowed: far fewer than the 41 total rows are in the DOM.
    expect(rowEls().length).toBeLessThan(41)
  })

  it('does NOT virtualize tree mode when renderDetail is set (variable-height rows)', () => {
    const tree: VRow[] = [{ id: 1, name: 'Root', children: [{ id: 2, name: 'C' }] }]
    render(() => (
      <IrisTable
        columns={vcols}
        data={tree}
        getSubRows={(r) => r.children}
        renderDetail={(r) => <div>d{(r as VRow).id}</div>}
        virtualScroll={{ itemHeight: 36, height: 200 }}
      />
    ))
    expect(document.querySelector('[data-iris-virtual-scroll]')).toBeNull()
  })
})

describe('IrisTable column virtualization', () => {
  const wideCols: IrisTableColumn<Record<string, unknown>>[] = Array.from(
    { length: 8 },
    (_, i) => ({
      key: `c${i}`,
      title: `C${i}`,
      width: 120,
    }),
  )
  const wideRows: Record<string, unknown>[] = [
    Object.fromEntries([['id', 1], ...wideCols.map((c) => [c.key, `${c.key}-v`])]),
  ]

  it('renders every column when disabled (default)', () => {
    render(() => <IrisTable columns={wideCols} data={wideRows} />)
    expect(document.querySelectorAll('[data-iris-table-header]').length).toBe(8)
  })

  it('renders only a window of columns when enabled', () => {
    render(() => <IrisTable columns={wideCols} data={wideRows} columnVirtualization />)
    const headerCount = document.querySelectorAll('[data-iris-table-header]').length
    expect(headerCount).toBeGreaterThan(0)
    expect(headerCount).toBeLessThan(8)
    expect(document.querySelector('[data-iris-table][data-column-virtualized=true]')).not.toBeNull()
    // Rendered header cells carry an explicit grid track.
    const first = document.querySelector('[data-iris-table-header]') as HTMLElement
    expect(first.style.gridColumnStart).toBeTruthy()
  })

  it('always renders pinned columns even when out of the window', () => {
    const cols = wideCols.map((c, i) => (i === 7 ? { ...c, pinned: 'right' as const } : c))
    render(() => <IrisTable columns={cols} data={wideRows} columnVirtualization />)
    // The far pinned column (index 7) renders despite being outside the window.
    expect(document.querySelector('[data-iris-table-header="c7"]')).not.toBeNull()
  })
})
