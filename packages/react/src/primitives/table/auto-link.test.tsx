import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(() => cleanup())

interface Row extends Record<string, unknown> {
  id: number
  url: string
  email: string
  text: string
}

const rows: Row[] = [
  { id: 1, url: 'https://example.com/a', email: 'user@example.com', text: 'plain words' },
]

const cols: IrisTableColumn<Row>[] = [
  { key: 'url', title: 'URL' },
  { key: 'email', title: 'Email' },
  { key: 'text', title: 'Text' },
]

function cell(key: string): HTMLElement {
  return document.querySelector(`[data-iris-table-cell="${key}"]`) as HTMLElement
}

describe('@iris-ui-kit/react IrisTable autoLink', () => {
  it('renders a URL cell as a data-iris-auto-link anchor (_blank + noreferrer)', () => {
    render(<IrisTable columns={cols} data={rows} autoLink />)
    const a = cell('url').querySelector('a[data-iris-auto-link]')!
    expect(a).not.toBeNull()
    expect(a.getAttribute('href')).toBe('https://example.com/a')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noreferrer')
    expect(a.textContent).toBe('https://example.com/a')
  })

  it('renders an email cell as a data-iris-auto-link anchor', () => {
    render(<IrisTable columns={cols} data={rows} autoLink />)
    const a = cell('email').querySelector('a[data-iris-auto-link]')!
    expect(a).not.toBeNull()
    expect(a.getAttribute('href')).toBe('user@example.com')
    expect(a.getAttribute('target')).toBe('_blank')
  })

  it('leaves a non-matching text cell plain (no anchor)', () => {
    render(<IrisTable columns={cols} data={rows} autoLink />)
    expect(cell('text').querySelector('a[data-iris-auto-link]')).toBeNull()
    expect(cell('text').textContent).toBe('plain words')
  })

  it('keeps an explicit col.link column winning over autoLink', () => {
    const linkCols: IrisTableColumn<Row>[] = [
      { key: 'url', title: 'URL', link: () => 'https://api.example.com/x' },
    ]
    render(<IrisTable columns={linkCols} data={rows} autoLink />)
    const a = cell('url').querySelector('a[data-iris-table-link]')!
    expect(a).not.toBeNull()
    expect(a.getAttribute('href')).toBe('https://api.example.com/x')
    expect(cell('url').querySelector('a[data-iris-auto-link]')).toBeNull()
  })

  it('detects on the formatter output string, not the raw value', () => {
    const fmtCols: IrisTableColumn<Row>[] = [
      {
        key: 'url',
        title: 'URL',
        formatter: (v) => `https://fmt.example.com/${String(v)}`,
      },
    ]
    render(<IrisTable columns={fmtCols} data={rows} autoLink />)
    const a = cell('url').querySelector('a[data-iris-auto-link]')!
    expect(a).not.toBeNull()
    expect(a.getAttribute('href')).toBe('https://fmt.example.com/https://example.com/a')
    expect(a.textContent).toBe('https://fmt.example.com/https://example.com/a')
  })

  it('is lazy without the autoLink prop (no anchors)', () => {
    render(<IrisTable columns={cols} data={rows} />)
    expect(document.querySelector('a[data-iris-auto-link]')).toBeNull()
  })

  it('stops propagation so a cell click does not reach onCellClick', () => {
    const onClick = vi.fn()
    render(<IrisTable columns={cols} data={rows} autoLink onCellClick={onClick} />)
    const a = cell('url').querySelector('a[data-iris-auto-link]')!
    act(() => {
      fireEvent.click(a)
    })
    expect(onClick).not.toHaveBeenCalled()
  })
})
