import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { IrisTable } from '../Table'
import type { IrisTableColumn } from '../types'

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

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

function seqTexts(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-iris-table-cell="__seq"]')].map(
    (c) => c.textContent ?? '',
  )
}

function seqRow(id: number, name: string): Row {
  return { id, name, age: 20 + id }
}

describe('IrisTable proxy seq (batch L)', () => {
  it('page 2 with pageSize 5 renders cumulative seq 6..10', async () => {
    const query = vi.fn(async ({ page }: { page: number }) => ({
      rows: [1, 2, 3, 4, 5].map((n) => seqRow((page - 1) * 5 + n, `R${(page - 1) * 5 + n}`)),
      total: 12,
    }))
    const { container } = render(
      <IrisTable
        columns={columns}
        data={[]}
        rowKey="id"
        seq
        proxyConfig={{ query, pageSize: 5, seq: true }}
      />,
    )
    await waitFor(() => expect(query).toHaveBeenCalledTimes(1))
    expect(seqTexts(container)).toEqual(['1', '2', '3', '4', '5'])
    fireEvent.click(container.querySelector('[data-iris-pagination-item="next"]')!)
    await waitFor(() => expect(query).toHaveBeenCalledTimes(2))
    expect(query).toHaveBeenLastCalledWith({ page: 2, pageSize: 5, sort: null, filters: {} })
    await waitFor(() => expect(seqTexts(container)).toEqual(['6', '7', '8', '9', '10']))
  })

  it('non-proxy seq is unchanged (seqStartIndex still applies)', () => {
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" seq seqStartIndex={100} />,
    )
    expect(seqTexts(container)).toEqual(['100', '101', '102'])
  })

  it('seqMethod wins over the proxy cumulative seq', async () => {
    const query = vi.fn(async () => ({ rows: rows.slice(0, 2), total: 3 }))
    const { container } = render(
      <IrisTable
        columns={columns}
        data={[]}
        rowKey="id"
        seq
        seqMethod={({ rowIndex }) => `R${rowIndex + 1}`}
        proxyConfig={{ query, seq: true }}
      />,
    )
    await waitFor(() => expect(seqTexts(container)).toEqual(['R1', 'R2']))
  })

  it('proxy without seq:true keeps the plain page-local numbering', async () => {
    const query = vi.fn(async () => ({ rows: rows.slice(0, 2), total: 3 }))
    const { container } = render(
      <IrisTable
        columns={columns}
        data={[]}
        rowKey="id"
        seq
        proxyConfig={{ query, pageSize: 5 }}
      />,
    )
    await waitFor(() => expect(seqTexts(container)).toEqual(['1', '2']))
  })
})

describe('IrisTable toolbar export (batch L)', () => {
  it('renders the export button with i18n label and fires onExport', () => {
    const onExport = vi.fn()
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" toolbar={{ onExport }} />,
    )
    const btn = container.querySelector('[data-iris-table-toolbar-export]')!
    expect(btn).not.toBeNull()
    expect(btn.getAttribute('aria-label')).toBe('Export')
    expect(btn.getAttribute('title')).toBe('Export')
    fireEvent.click(btn)
    expect(onExport).toHaveBeenCalledTimes(1)
  })

  it('does not render the export button without onExport', () => {
    const { container } = render(
      <IrisTable columns={columns} data={rows} rowKey="id" toolbar={{ title: 'T' }} />,
    )
    expect(container.querySelector('[data-iris-table-toolbar-export]')).toBeNull()
  })
})

describe('IrisTable column link (batch L)', () => {
  it('renders an anchor with href and the callback label', () => {
    const linkCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        link: (value, row) => ({ href: `/u/${row.id}`, label: `Go ${String(value)}` }),
      },
      { key: 'age', title: 'Age' },
    ]
    const { container } = render(<IrisTable columns={linkCols} data={rows} rowKey="id" />)
    const anchors = [...container.querySelectorAll('[data-iris-table-link]')]
    expect(anchors.length).toBe(3)
    expect(anchors[0]?.getAttribute('href')).toBe('/u/1')
    expect(anchors[0]?.textContent).toBe('Go Charlie')
  })

  it('label defaults to the cell text when the callback omits it', () => {
    const linkCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', link: () => ({ href: '/x' }) },
    ]
    const { container } = render(<IrisTable columns={linkCols} data={rows} rowKey="id" />)
    const a = container.querySelector('[data-iris-table-link]')!
    expect(a.getAttribute('href')).toBe('/x')
    expect(a.textContent).toBe('Charlie')
  })

  it('a plain string return links with the cell text', () => {
    const linkCols: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', link: () => '/plain' }]
    const { container } = render(<IrisTable columns={linkCols} data={rows} rowKey="id" />)
    const a = container.querySelector('[data-iris-table-link]')!
    expect(a.getAttribute('href')).toBe('/plain')
    expect(a.getAttribute('target')).toBeNull()
    expect(a.getAttribute('rel')).toBeNull()
    expect(a.textContent).toBe('Charlie')
  })

  it('null falls through to the formatter', () => {
    const linkCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        formatter: (value) => String(value).toUpperCase(),
        link: () => null,
      },
    ]
    const { container } = render(<IrisTable columns={linkCols} data={rows} rowKey="id" />)
    expect(container.querySelector('[data-iris-table-link]')).toBeNull()
    expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('CHARLIE')
  })

  it('undefined falls through to the raw value', () => {
    const linkCols: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', link: () => undefined }]
    const { container } = render(<IrisTable columns={linkCols} data={rows} rowKey="id" />)
    expect(container.querySelector('[data-iris-table-link]')).toBeNull()
    expect(container.querySelector('[data-iris-table-cell="name"]')?.textContent).toBe('Charlie')
  })

  it('link wraps the formatted text when label is absent', () => {
    const linkCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        formatter: (value) => String(value).toUpperCase(),
        link: (value) => `/u/${String(value).toLowerCase()}`,
      },
    ]
    const { container } = render(<IrisTable columns={linkCols} data={rows} rowKey="id" />)
    const a = container.querySelector('[data-iris-table-link]')!
    expect(a.getAttribute('href')).toBe('/u/charlie')
    expect(a.textContent).toBe('CHARLIE')
  })

  it('_blank target adds rel=noreferrer', () => {
    const linkCols: IrisTableColumn<Row>[] = [
      { key: 'name', title: 'Name', link: () => ({ href: '/ext', target: '_blank' }) },
    ]
    const { container } = render(<IrisTable columns={linkCols} data={rows} rowKey="id" />)
    const a = container.querySelector('[data-iris-table-link]')!
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noreferrer')
  })

  it('anchor clicks stop propagation (row click not fired)', () => {
    const onRowClick = vi.fn()
    const linkCols: IrisTableColumn<Row>[] = [{ key: 'name', title: 'Name', link: () => '/x' }]
    const { container } = render(
      <IrisTable columns={linkCols} data={rows} rowKey="id" onRowClick={onRowClick} />,
    )
    fireEvent.click(container.querySelector('[data-iris-table-link]')!)
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('render still wins over link (precedence render > html > link > formatter)', async () => {
    const linkCols: IrisTableColumn<Row>[] = [
      {
        key: 'name',
        title: 'Name',
        render: (value) => <b>{String(value)}!</b>,
        link: () => '/ignored',
      },
    ]
    const { container } = render(<IrisTable columns={linkCols} data={rows} rowKey="id" />)
    await act(async () => {})
    expect(container.querySelector('[data-iris-table-link]')).toBeNull()
    expect(container.querySelector('[data-iris-table-cell="name"] b')?.textContent).toBe('Charlie!')
  })
})
