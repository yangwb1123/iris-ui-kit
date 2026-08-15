import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from '../index'
import type { IrisTableColumn } from '../types'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

interface Row extends Record<string, unknown> {
  id: number
  name: string
}

const rows: Row[] = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
]

const cols: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name' }]

function root(): HTMLElement {
  return document.querySelector('[data-iris-table]') as HTMLElement
}

function layer(): HTMLElement | null {
  return document.querySelector('[data-iris-watermark]')
}

function tiles(): HTMLElement[] {
  return Array.from(document.querySelectorAll('[data-iris-watermark-tile]'))
}

// ── Batch BU table watermark (iris 独有 — vxe has no watermark) ──────────
describe('IrisTable watermark (batch BU, iris 独有)', () => {
  it('no prop → zero watermark nodes (presence-gated)', () => {
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(container.querySelector('[data-iris-watermark]')).toBeNull()
    expect(container.querySelector('[data-iris-watermark-tile]')).toBeNull()
    expect(root().style.position).toBe('')
  })

  it('renders the rotated tiled layer containing the text', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" watermark="机密" />,
    )
    const el = container.querySelector('[data-iris-watermark]')
    expect(el).not.toBeNull()
    // The standalone IrisWatermark precedent's 72-tile layout.
    expect(tiles().length).toBe(72)
    for (const tile of tiles()) {
      expect(tile.textContent).toBe('机密')
    }
  })

  it('layer is aria-hidden and non-interactive (pointer-events/user-select none)', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" watermark="SECRET" />,
    )
    const el = container.querySelector('[data-iris-watermark]') as HTMLElement
    expect(el.getAttribute('aria-hidden')).toBe('true')
    expect(el.style.pointerEvents).toBe('none')
    expect(el.style.userSelect).toBe('none')
  })

  it('tiles rotate -22deg with token color and token size', () => {
    render(<IrisTable columns={cols} data={rows} rowKey="id" watermark="X" />)
    const tile = tiles()[0] as HTMLElement
    expect(tile.style.transform).toBe('rotate(-22deg)')
    expect(tile.style.color).toBe('var(--iris-muted)')
    expect(tile.style.fontSize).toBe('var(--iris-font-size-lg, 16px)')
  })

  it('root becomes a positioning context — forced relative even when the caller style overrides', () => {
    render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        watermark="X"
        style={{ position: 'static' }}
      />,
    )
    // The watermark anchor cannot be broken by a caller-provided style.
    expect(root().style.position).toBe('relative')
  })

  it('empty string hides the layer (presence gate on non-empty text)', () => {
    const { container } = render(<IrisTable columns={cols} data={rows} rowKey="id" watermark="" />)
    expect(container.querySelector('[data-iris-watermark]')).toBeNull()
    expect(root().style.position).toBe('')
  })

  it('rerender updates every tile to the new text', () => {
    const { rerender } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" watermark="DRAFT" />,
    )
    rerender(<IrisTable columns={cols} data={rows} rowKey="id" watermark="FINAL" />)
    expect(tiles().length).toBe(72)
    for (const tile of tiles()) {
      expect(tile.textContent).toBe('FINAL')
    }
    rerender(<IrisTable columns={cols} data={rows} rowKey="id" />)
    expect(layer()).toBeNull()
  })

  it('coexists with zoom — watermark rides the fixed overlay and tiles survive the toggle', () => {
    const { container } = render(
      <IrisTable
        columns={cols}
        data={rows}
        rowKey="id"
        watermark="ZOOM"
        toolbar={{}}
        zoomConfig={{ showButton: true }}
      />,
    )
    expect(tiles().length).toBe(72)
    expect(root().style.position).toBe('relative')
    fireEvent.click(container.querySelector('[data-iris-table-zoom]') as HTMLElement)
    // Zoom forces position: fixed — the watermark layer still renders inside it.
    expect(root().getAttribute('data-iris-table-zoomed')).toBe('true')
    expect(root().style.position).toBe('fixed')
    expect(tiles().length).toBe(72)
    for (const tile of tiles()) {
      expect(tile.textContent).toBe('ZOOM')
    }
  })

  it('coexists with fixed height — layer anchors to the scroll container root', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" watermark="H" height={300} />,
    )
    expect(root().getAttribute('data-iris-table-fixed-height')).toBe('true')
    const el = container.querySelector('[data-iris-watermark]') as HTMLElement
    expect(el).not.toBeNull()
    expect(el.style.position).toBe('absolute')
    expect(el.style.inset).toBe('0')
  })

  it('layer is pure display — no data mutation, no extra handlers', () => {
    const { container } = render(
      <IrisTable columns={cols} data={rows} rowKey="id" watermark="PURE" />,
    )
    const el = container.querySelector('[data-iris-watermark]') as HTMLElement
    // Tiles never carry handlers/roles — they are inert spans.
    for (const tile of tiles()) {
      expect(tile.getAttribute('role')).toBeNull()
      expect(tile.getAttribute('tabindex')).toBeNull()
    }
    // The layer is embedded INSIDE the root (not wrapping it) — it anchors to
    // the table's positioning context, leaving the scroll container intact.
    expect(root().contains(el)).toBe(true)
  })
})
