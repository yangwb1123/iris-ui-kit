/* Batch CF empty-state action button (iris 独有 — vxe has no empty-state
   action). The `emptyState` prop additionally accepts an `IrisTableEmptyState`
   descriptor `{ text?, action? }`: the object form renders centered text plus
   an inline action button (`data-iris-empty-action`) on the same row, styled
   with `--iris-*` tokens only (error-row retry precedent). Plain ReactNode
   values (elements, arrays) stay on the untouched node path — zero wrapper. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const columns: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]
const rows: Row[] = [{ id: 1, name: 'A' }]

function emptyRow(): HTMLElement | null {
  return document.querySelector('[data-iris-table-row="empty"]')
}

function emptyAction(): HTMLElement | null {
  return document.querySelector('[data-iris-empty-action]')
}

// ── Batch CF empty-state action button (iris 独有) ──────────────────────
describe('IrisTable emptyState action (batch CF, iris 独有)', () => {
  it('descriptor renders text + action button on the empty row (spec ① 渲染)', () => {
    render(
      <IrisTable
        columns={columns}
        data={[]}
        emptyState={{ text: 'No rows yet', action: { label: 'Add row', onClick: () => {} } }}
      />,
    )
    const row = emptyRow()
    expect(row).not.toBeNull()
    expect(row?.textContent).toContain('No rows yet')
    const btn = emptyAction()
    expect(btn).not.toBeNull()
    expect(btn?.textContent).toBe('Add row')
    expect(btn?.getAttribute('type')).toBe('button')
    // Text and button share the same centered row (单行 inline flow).
    expect(btn?.parentElement).toBe(row)
  })

  it('clicking the action fires its onClick (spec ② 点击)', () => {
    const onClick = vi.fn()
    render(
      <IrisTable
        columns={columns}
        data={[]}
        emptyState={{ action: { label: 'Reload', onClick } }}
      />,
    )
    const btn = emptyAction()
    expect(btn).not.toBeNull()
    fireEvent.click(btn as HTMLElement)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('omitted text falls back to the localized default', () => {
    render(
      <IrisTable
        columns={columns}
        data={[]}
        emptyState={{ action: { label: 'Go', onClick: () => {} } }}
      />,
    )
    expect(emptyRow()?.textContent).toContain('No data to display')
    expect(emptyAction()?.textContent).toBe('Go')
  })

  it('descriptor text wins over the localized default', () => {
    render(
      <IrisTable
        columns={columns}
        data={[]}
        emptyState={{ text: 'Nothing found', action: { label: 'Clear', onClick: () => {} } }}
      />,
    )
    expect(emptyRow()?.textContent).toContain('Nothing found')
    expect(emptyRow()?.textContent).not.toContain('No data to display')
  })

  it('action omitted fails closed: text renders, no button', () => {
    render(<IrisTable columns={columns} data={[]} emptyState={{ text: 'Empty here' }} />)
    expect(emptyRow()?.textContent).toBe('Empty here')
    expect(emptyAction()).toBeNull()
  })

  it('ReactNode element regression: renders untouched with zero wrapper', () => {
    render(
      <IrisTable
        columns={columns}
        data={[]}
        emptyState={<div data-testid="empty">Nothing here</div>}
      />,
    )
    const row = emptyRow()
    const node = document.querySelector('[data-testid="empty"]')
    expect(node).not.toBeNull()
    // Zero wrapper: the element is the row's only child.
    expect(row?.childNodes.length).toBe(1)
    expect(row?.firstChild).toBe(node)
    expect(emptyAction()).toBeNull()
    expect(row?.textContent).not.toContain('No data to display')
  })

  it('array of elements stays on the node path (guard excludes arrays)', () => {
    render(
      <IrisTable
        columns={columns}
        data={[]}
        emptyState={[<span key="a">Line A</span>, <span key="b">Line B</span>]}
      />,
    )
    const row = emptyRow()
    expect(row?.textContent).toBe('Line ALine B')
    expect(emptyAction()).toBeNull()
    // Zero wrapper: both spans are direct children of the row.
    expect(row?.childNodes.length).toBe(2)
  })

  it('action button style is token-driven and text gap is RTL-safe', () => {
    render(
      <IrisTable
        columns={columns}
        data={[]}
        emptyState={{ text: 'Empty', action: { label: 'Create', onClick: () => {} } }}
      />,
    )
    const btn = emptyAction() as HTMLElement
    expect(btn.style.border).toContain('var(--iris-border)')
    expect(btn.style.background).toBe('var(--iris-surface)')
    expect(btn.style.color).toBe('var(--iris-foreground)')
    expect(btn.style.borderRadius).toBe('var(--iris-radius-sm, 4px)')
    expect(btn.style.cursor).toBe('pointer')
    const span = btn.previousElementSibling as HTMLElement
    expect(span.tagName).toBe('SPAN')
    expect(span.style.marginInlineEnd).toBe('var(--iris-space-sm, 12px)')
  })

  it('no empty row / no action button when data is present', () => {
    render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        emptyState={{ text: 'Empty', action: { label: 'Add', onClick: () => {} } }}
      />,
    )
    expect(emptyRow()).toBeNull()
    expect(emptyAction()).toBeNull()
    expect(document.querySelector('[data-iris-table-row="1"]')).not.toBeNull()
  })
})
