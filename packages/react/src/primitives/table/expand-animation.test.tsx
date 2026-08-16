import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
  { id: 3, name: 'Bob', age: 28 },
]

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age', align: 'right' },
]

interface TreeRow extends Record<string, unknown> {
  id: number
  name: string
  children?: TreeRow[]
}

const treeData: TreeRow[] = [
  {
    id: 1,
    name: 'Root A',
    children: [
      { id: 11, name: 'Child A1' },
      { id: 12, name: 'Child A2' },
    ],
  },
  { id: 2, name: 'Root B' },
]

const treeColumns: IrisTableColumn<TreeRow>[] = [{ key: 'name', title: 'Name' }]

function styleSheet(): string {
  const el = document.getElementById('iris-table-row-styles')
  return el ? (el.textContent ?? '') : ''
}

function detailWrap(rowId: string | number): HTMLElement | null {
  return document.querySelector(`[data-iris-table-row-detail="${rowId}"]`)
}

function detailToggle(rowId: string | number): HTMLElement {
  return document.querySelector(
    `[data-iris-table-row="${rowId}"] [data-iris-table-expand-toggle]`,
  ) as HTMLElement
}

function treeToggle(rowId: number): HTMLElement | null {
  return document.querySelector(`[data-iris-table-row="${rowId}"] [data-iris-table-tree-toggle]`)
}

// ── Batch CL: 行展开动画 (iris 独有 — vxe has no expand animation) ──────────
describe('IrisTable expandAnimation (batch CL, iris 独有)', () => {
  it('fail-closed: no prop → no anim attr on detail wraps or tree rows', () => {
    // Detail: expanding without the prop renders the wrap WITHOUT the attr.
    render(<IrisTable columns={baseColumns} data={rows} renderDetail={(r) => <div>D{r.id}</div>} />)
    act(() => fireEvent.click(detailToggle(1)))
    expect(detailWrap(1)).not.toBeNull()
    expect(detailWrap(1)!.getAttribute('data-iris-expand-anim')).toBeNull()
    cleanup()

    // Tree: an expanded branch renders child rows without the attr.
    render(<IrisTable columns={treeColumns} data={treeData} getSubRows={(r) => r.children} />)
    act(() => fireEvent.click(treeToggle(1)!))
    const childRow = document.querySelector('[data-iris-table-row="11"]')
    expect(childRow).not.toBeNull()
    expect(childRow!.getAttribute('data-iris-expand-anim')).toBeNull()
  })

  it('detail expand/collapse toggles the anim attr with the wrap', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        renderDetail={(r) => <div>D{r.id}</div>}
        expandAnimation
      />,
    )
    // Collapsed: no wrap at all.
    expect(detailWrap(2)).toBeNull()
    act(() => fireEvent.click(detailToggle(2)))
    // Expanded: the wrap carries the anim attr.
    expect(detailWrap(2)).not.toBeNull()
    expect(detailWrap(2)!.getAttribute('data-iris-expand-anim')).toBe('true')
    // Collapse again: the wrap unmounts (no lingering animated element).
    act(() => fireEvent.click(detailToggle(2)))
    expect(detailWrap(2)).toBeNull()
  })

  it('stylesheet carries the expand-enter keyframes (max-height + opacity)', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    const css = styleSheet()
    expect(css).toContain('@keyframes iris-table-expand-enter')
    expect(css).toContain('from { max-height: 0; opacity: 0; overflow: hidden; }')
    expect(css).toContain(
      'to { max-height: var(--iris-table-expand-max, 512px); opacity: 1; overflow: hidden; }',
    )
  })

  it('duration is token-driven with a fallback (motion token precedent)', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    const css = styleSheet()
    // The selector + the animation shorthand (token first, px fallback).
    expect(css).toContain('[data-iris-expand-anim="true"]')
    expect(css).toContain(
      'animation: iris-table-expand-enter var(--iris-duration-md, 200ms) ease-out',
    )
    // No hardcoded non-token values beyond the fallbacks.
    expect(css).not.toContain('animation-duration: 200ms')
  })

  it('reduced-motion turns the animation off entirely', () => {
    render(<IrisTable columns={baseColumns} data={rows} />)
    const css = styleSheet()
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('[data-iris-expand-anim="true"] {\n    animation: none;')
  })

  it('tree mode: root rows (depth 0) stay static, child rows animate', () => {
    render(
      <IrisTable
        columns={treeColumns}
        data={treeData}
        getSubRows={(r) => r.children}
        expandAnimation
      />,
    )
    // Roots collapsed: no attr anywhere yet.
    expect(document.querySelector('[data-iris-expand-anim="true"]')).toBeNull()
    act(() => fireEvent.click(treeToggle(1)!))
    // Root row 1 is depth 0 → static; child rows 11/12 are depth 1 → animated.
    const rootRow = document.querySelector('[data-iris-table-row="1"]')
    expect(rootRow!.getAttribute('data-iris-expand-anim')).toBeNull()
    for (const id of ['11', '12']) {
      const child = document.querySelector(`[data-iris-table-row="${id}"]`)
      expect(child!.getAttribute('data-iris-expand-anim')).toBe('true')
    }
    // Root B (leaf, depth 0) untouched.
    const rootB = document.querySelector('[data-iris-table-row="2"]')
    expect(rootB!.getAttribute('data-iris-expand-anim')).toBeNull()
  })

  it('initially-expanded rows replay the animation on mount', () => {
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        renderDetail={(r) => <div>D{r.id}</div>}
        defaultExpandedRowKeys={[1]}
        expandAnimation
      />,
    )
    // Mounted already-expanded → the wrap is present WITH the anim attr
    // (the enter animation plays on first paint, same as a user expand).
    expect(detailWrap(1)).not.toBeNull()
    expect(detailWrap(1)!.getAttribute('data-iris-expand-anim')).toBe('true')
    expect(detailWrap(2)).toBeNull()
  })

  it('virtual mode is inert: no anim attr even with the prop on', () => {
    // Detail + virtual: the slot-mount path never animates.
    render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        renderDetail={(r) => <div>D{r.id}</div>}
        expandAnimation
        virtualScroll={{ itemHeight: 36, height: 120 }}
      />,
    )
    act(() => fireEvent.click(detailToggle(1)))
    expect(detailWrap(1)).not.toBeNull()
    expect(detailWrap(1)!.getAttribute('data-iris-expand-anim')).toBeNull()
    cleanup()

    // Tree + virtual: expanded child rows stay static too.
    render(
      <IrisTable
        columns={treeColumns}
        data={treeData}
        getSubRows={(r) => r.children}
        expandAnimation
        virtualScroll={{ itemHeight: 36, height: 120 }}
      />,
    )
    act(() => fireEvent.click(treeToggle(1)!))
    expect(document.querySelector('[data-iris-expand-anim="true"]')).toBeNull()
    const childRow = document.querySelector('[data-iris-table-row="11"]')
    if (childRow) {
      expect(childRow.getAttribute('data-iris-expand-anim')).toBeNull()
    }
  })
})
