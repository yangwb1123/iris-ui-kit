import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Charlie', age: 25 },
  { id: 2, name: 'Alice', age: 32 },
]

const baseColumns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]')!
}

// ── 1. Zoom overlay (vxe toolbar zoom parity, batch U) ────────────────────
describe('IrisTable zoomConfig (batch U)', () => {
  it('renders the toggle button only when zoomConfig.showButton is set', () => {
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{}}
        zoomConfig={{ showButton: true }}
      />,
    )
    expect(container.querySelector('[data-iris-table-zoom]')).not.toBeNull()
  })

  it('renders no zoom button without zoomConfig (or with showButton falsy)', () => {
    const { container, rerender } = render(
      <IrisTable columns={baseColumns} data={rows} rowKey="id" toolbar={{}} />,
    )
    expect(container.querySelector('[data-iris-table-zoom]')).toBeNull()
    rerender(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{}}
        zoomConfig={{ showButton: false }}
      />,
    )
    expect(container.querySelector('[data-iris-table-zoom]')).toBeNull()
  })

  it('renders no zoom button without a toolbar (the toggle lives in the toolbar)', () => {
    const { container } = render(
      <IrisTable columns={baseColumns} data={rows} rowKey="id" zoomConfig={{ showButton: true }} />,
    )
    expect(container.querySelector('[data-iris-table-toolbar]')).toBeNull()
    expect(container.querySelector('[data-iris-table-zoom]')).toBeNull()
  })

  it('click toggles data-iris-table-zoomed on the root and the button label', () => {
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{}}
        zoomConfig={{ showButton: true }}
      />,
    )
    const btn = container.querySelector('[data-iris-table-zoom]')!
    expect(root().getAttribute('data-iris-table-zoomed')).toBeNull()
    expect(btn.getAttribute('aria-label')).toBe('Zoom in')
    expect(btn.textContent).toBe('⛶')
    fireEvent.click(btn)
    expect(root().getAttribute('data-iris-table-zoomed')).toBe('true')
    expect(btn.getAttribute('aria-label')).toBe('Zoom out')
    expect(btn.textContent).toBe('✕')
    fireEvent.click(btn)
    expect(root().getAttribute('data-iris-table-zoomed')).toBeNull()
  })

  it('Esc exits zoom (window listener active only while zoomed)', () => {
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{}}
        zoomConfig={{ showButton: true }}
      />,
    )
    fireEvent.click(container.querySelector('[data-iris-table-zoom]')!)
    expect(root().getAttribute('data-iris-table-zoomed')).toBe('true')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(root().getAttribute('data-iris-table-zoomed')).toBeNull()
    // Other keys do nothing while zoomed.
    fireEvent.click(container.querySelector('[data-iris-table-zoom]')!)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(root().getAttribute('data-iris-table-zoomed')).toBe('true')
  })

  it('the zoom overlay keeps the internal grid intact (rows still render)', () => {
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{}}
        zoomConfig={{ showButton: true }}
      />,
    )
    fireEvent.click(container.querySelector('[data-iris-table-zoom]')!)
    // Header + body cells all still present under the zoomed root.
    expect(container.querySelectorAll('[data-iris-table-header]')).toHaveLength(2)
    expect(container.querySelectorAll('[data-iris-table-cell]')).toHaveLength(4)
    // The injected stylesheet carries the fixed-overlay rule (token-driven).
    const style = document.getElementById('iris-table-row-styles')
    expect(style?.textContent).toContain('[data-iris-table][data-iris-table-zoomed]')
    expect(style?.textContent).toContain('z-index: var(--iris-z-popover, 1000)')
    expect(style?.textContent).toContain('background: var(--iris-surface)')
  })

  it('zoomed root engages the fixed-height machinery (sticky header attribute)', () => {
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{}}
        zoomConfig={{ showButton: true }}
      />,
    )
    // Without zoom and without height: no fixed-height engagement.
    expect(root().getAttribute('data-iris-table-fixed-height')).toBeNull()
    fireEvent.click(container.querySelector('[data-iris-table-zoom]')!)
    expect(root().getAttribute('data-iris-table-fixed-height')).toBe('true')
  })

  it('while zoomed the toolbar is lifted above the overlay (✕ stays reachable)', () => {
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{ title: 'T' }}
        zoomConfig={{ showButton: true }}
      />,
    )
    const toolbar = container.querySelector('[data-iris-table-toolbar]') as HTMLElement
    // Not zoomed: no lift (defaults unchanged).
    expect(toolbar.style.zIndex).toBe('')
    fireEvent.click(container.querySelector('[data-iris-table-zoom]')!)
    expect(toolbar.style.zIndex).toBe('calc(var(--iris-z-popover, 1000) + 1)')
    // The ✕ exit button is inside the lifted toolbar.
    expect(container.querySelector('[data-iris-table-zoom]')?.textContent).toBe('✕')
    fireEvent.click(container.querySelector('[data-iris-table-zoom]')!)
    expect(toolbar.style.zIndex).toBe('')
  })

  it('zIndex prop cannot unpin the overlay while zoomed (position forced fixed)', () => {
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{}}
        zIndex={5}
        zoomConfig={{ showButton: true }}
      />,
    )
    // Not zoomed: the zIndex prop rides along as position: relative.
    expect(root().style.position).toBe('relative')
    expect(root().style.zIndex).toBe('5')
    fireEvent.click(container.querySelector('[data-iris-table-zoom]')!)
    // Zoomed: inline position: fixed wins over the prop's relative.
    expect(root().style.position).toBe('fixed')
    expect(root().style.zIndex).toBe('5')
  })
})

// ── 2. Section layouts (vxe-grid layouts parity, batch U) ─────────────────
describe('IrisTable layouts (batch U)', () => {
  it('defaults render the form, toolbar and (proxy) pager — unchanged', async () => {
    const query = vi.fn(() => Promise.resolve({ rows: [rows[0]], total: 1 }))
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        formConfig={{ fields: [{ key: 'name', label: 'Name' }] }}
        toolbar={{ title: 'T' }}
        proxyConfig={{ query }}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-pager]')).toBeTruthy()
    })
    expect(container.querySelector('[data-iris-table-form]')).toBeTruthy()
    expect(container.querySelector('[data-iris-table-toolbar]')).toBeTruthy()
  })

  it("form: 'hidden' skips the form block while formConfig stays accepted", () => {
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        formConfig={{ fields: [{ key: 'name', label: 'Name' }] }}
        layouts={{ form: 'hidden' }}
      />,
    )
    expect(container.querySelector('[data-iris-table-form]')).toBeNull()
    // The rest still renders.
    expect(container.querySelectorAll('[data-iris-table-header]')).toHaveLength(2)
  })

  it("toolbar: 'hidden' skips the toolbar (and its zoom toggle with it)", () => {
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        toolbar={{ title: 'T' }}
        zoomConfig={{ showButton: true }}
        layouts={{ toolbar: 'hidden' }}
      />,
    )
    expect(container.querySelector('[data-iris-table-toolbar]')).toBeNull()
    expect(container.querySelector('[data-iris-table-zoom]')).toBeNull()
  })

  it("pager: 'hidden' skips the proxy pager", async () => {
    const query = vi.fn(() => Promise.resolve({ rows: [rows[0]], total: 1 }))
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={[]}
        rowKey="id"
        proxyConfig={{ query }}
        layouts={{ pager: 'hidden' }}
      />,
    )
    await waitFor(() => {
      expect(container.querySelector('[data-iris-table-cell="name"]')).toBeTruthy()
    })
    expect(container.querySelector('[data-iris-table-pager]')).toBeNull()
  })

  it('suppression is independent: hiding the form leaves the toolbar intact', () => {
    const { container } = render(
      <IrisTable
        columns={baseColumns}
        data={rows}
        rowKey="id"
        formConfig={{ fields: [{ key: 'name', label: 'Name' }] }}
        toolbar={{ title: 'T' }}
        layouts={{ form: 'hidden' }}
      />,
    )
    expect(container.querySelector('[data-iris-table-form]')).toBeNull()
    expect(container.querySelector('[data-iris-table-toolbar]')?.textContent).toContain('T')
  })
})

// ── 3. Column visibleMethod (vxe column visibleMethod parity, batch U) ────
describe('IrisTable visibleMethod (batch U)', () => {
  it('false hides the column (header + body cells)', () => {
    const columns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', visibleMethod: () => false },
    ]
    const { container } = render(<IrisTable columns={columns} data={rows} rowKey="id" />)
    expect(container.querySelectorAll('[data-iris-table-header]')).toHaveLength(1)
    expect(container.querySelector('[data-iris-table-header="age"]')).toBeNull()
    expect(container.querySelector('[data-iris-table-cell="age"]')).toBeNull()
    expect(container.querySelectorAll('[data-iris-table-cell]')).toHaveLength(2)
  })

  it('true or absent keeps the column', () => {
    const spy = vi.fn(() => true)
    const columns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', visibleMethod: spy },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(<IrisTable columns={columns} data={rows} rowKey="id" />)
    expect(container.querySelectorAll('[data-iris-table-header]')).toHaveLength(2)
    expect(container.querySelector('[data-iris-table-header="name"]')).toBeTruthy()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('columnVisibility false still wins over visibleMethod true', () => {
    const columns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', visibleMethod: () => true },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={{ name: false, age: true }}
      />,
    )
    expect(container.querySelector('[data-iris-table-header="name"]')).toBeNull()
    expect(container.querySelector('[data-iris-table-header="age"]')).toBeTruthy()
  })

  it('visibleMethod false overrides columnVisibility true (the column vetoes itself)', () => {
    const columns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', visibleMethod: () => false },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        columnVisibility={{ name: true, age: true }}
      />,
    )
    expect(container.querySelector('[data-iris-table-header="name"]')).toBeNull()
    expect(container.querySelector('[data-iris-table-header="age"]')).toBeTruthy()
  })

  it('is evaluated once per render (memo), not per row', () => {
    const spy = vi.fn(() => true)
    const columns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', visibleMethod: spy },
      { key: 'age', title: 'Age' },
    ]
    render(<IrisTable columns={columns} data={rows} rowKey="id" />)
    expect(spy).toHaveBeenCalledTimes(1)
    // Re-render with new data reference: still one call per render.
    render(<IrisTable columns={columns} data={[...rows]} rowKey="id" />)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('grouped tables: top-level scope mirrors columnVisibility (leaf methods are not consulted)', () => {
    const leafVeto = vi.fn(() => false)
    const columns: IrisTableColumn<Row>[] = [
      {
        key: 'group',
        title: 'Group',
        children: [
          { key: 'name', title: 'Name' },
          { key: 'age', title: 'Age', visibleMethod: leafVeto },
        ],
      },
      { key: 'hidden', title: 'Hidden', visibleMethod: () => false },
    ]
    const { container } = render(<IrisTable columns={columns} data={rows} rowKey="id" />)
    // Top-level veto: the column disappears entirely.
    expect(container.querySelector('[data-iris-table-header="hidden"]')).toBeNull()
    // Grouped leaves keep rendering (documented scope, mirrors columnVisibility).
    expect(container.querySelector('[data-iris-table-header="group"]')).toBeTruthy()
    expect(container.querySelector('[data-iris-table-header="age"]')).toBeTruthy()
    expect(leafVeto).not.toHaveBeenCalled()
  })
})

// ── 4. Combined (batch U) ─────────────────────────────────────────────────
describe('IrisTable batch U combined', () => {
  it('zoom + layouts + visibleMethod compose', () => {
    const columns: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name' },
      { key: 'age', title: 'Age', visibleMethod: () => false },
    ]
    const { container } = render(
      <IrisTable
        columns={columns}
        data={rows}
        rowKey="id"
        formConfig={{ fields: [{ key: 'name', label: 'Name' }] }}
        toolbar={{ title: 'T' }}
        zoomConfig={{ showButton: true }}
        layouts={{ form: 'hidden' }}
      />,
    )
    expect(container.querySelector('[data-iris-table-form]')).toBeNull()
    expect(container.querySelector('[data-iris-table-toolbar]')).toBeTruthy()
    expect(container.querySelector('[data-iris-table-zoom]')).toBeTruthy()
    expect(container.querySelector('[data-iris-table-header="age"]')).toBeNull()
    fireEvent.click(container.querySelector('[data-iris-table-zoom]')!)
    expect(root().getAttribute('data-iris-table-zoomed')).toBe('true')
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })
    expect(root().getAttribute('data-iris-table-zoomed')).toBeNull()
  })
})
