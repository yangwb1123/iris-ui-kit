import { describe, expect, it, vi } from 'vitest'
import {
  toGridColumnsOptions,
  toGridExpansionOptions,
  toGridFilteringOptions,
  toGridPaginationOptions,
  toGridRowsOptions,
  toGridSelectionOptions,
  toGridSortingOptions,
} from './legacyGridOptions'

type Row = { id: number; name: string }

describe('legacy Grid feature option converters', () => {
  it('combines all legacy column channels and preserves undefined controlled order', () => {
    const onColumnOrderChange = vi.fn()
    const onColumnPinnedChange = vi.fn()
    const options = toGridColumnsOptions({
      columnVisibility: { age: false },
      onColumnOrderChange,
      columnWidths: { name: 120 },
      defaultColumnWidths: { name: 80 },
      pinnedColumns: { name: null },
      onColumnPinnedChange,
    })

    expect(options).toMatchObject({
      visibility: { age: false },
      visibilityControlled: true,
      orderControlled: true,
      widths: { name: 120 },
      defaultWidths: { name: 80 },
      pinned: { name: null },
      onOrderChange: onColumnOrderChange,
      onPinnedChange: onColumnPinnedChange,
    })
  })

  it('preserves the data reference unless keepSource requests an initial copy', () => {
    const data: Row[] = [{ id: 1, name: 'Ada' }]
    const beforeChange = vi.fn()
    const onChange = vi.fn()

    const direct = toGridRowsOptions({ data, beforeChange, onChange })
    const copied = toGridRowsOptions({ data, keepSource: true })

    expect(direct.initialRows).toBe(data)
    expect(direct.options).toEqual({
      onBeforeRowsChange: beforeChange,
      onRowsChange: onChange,
    })
    expect(copied.initialRows).not.toBe(data)
    expect(copied.initialRows).toEqual(data)
  })

  it('maps the legacy multi spelling into the core selection mode', () => {
    const onSelectionChange = vi.fn()
    expect(
      toGridSelectionOptions({
        selectable: 'single',
        selection: [1],
        defaultSelection: [2],
        onSelectionChange,
      }),
    ).toEqual({
      mode: 'single',
      value: [1],
      defaultValue: [2],
      onChange: onSelectionChange,
    })
    expect(toGridSelectionOptions({ selectable: 'multi' }).mode).toBe('multiple')
    expect(toGridSelectionOptions({ selectable: 'none' }).mode).toBe('multiple')
  })

  it('normalizes expansion keys without mutating the legacy list', () => {
    const keys = [1, '2'] as const
    const onChange = vi.fn()
    const options = toGridExpansionOptions({ defaultExpandedRowKeys: keys, onChange })

    expect(options).toEqual({ mode: 'multiple', defaultValue: ['1', '2'], onChange })
    expect(keys).toEqual([1, '2'])
  })

  it('maps proxy pagination and keeps request orchestration in the adapter', () => {
    const request = vi.fn()
    const onPageChange = vi.fn()
    const options = toGridPaginationOptions({
      proxyConfig: { defaultPage: 2, pageSize: 20, onPageChange },
      state: { page: 3, pageSize: 25, total: 101 },
      request,
    })

    expect(options).toMatchObject({
      page: 3,
      pageSize: 25,
      total: 101,
      defaultPage: 2,
      defaultPageSize: 20,
    })
    options.onChange?.({ page: 4, pageSize: 25, reason: 'page' })
    expect(request).toHaveBeenCalledWith({ page: 4, pageSize: 25 })
    expect(onPageChange).toHaveBeenCalledWith(4, 25)
  })

  it('renames legacy sorting columns and forwards controlled channels', () => {
    const columns = [{ key: 'name', sortable: true }]
    const sort = { key: 'name', direction: 'asc' as const }
    const onSortChange = vi.fn()
    const options = toGridSortingOptions<Row>({ columns, sort, onSortChange, multiSort: true })

    expect(options.leafColumns).toBe(columns)
    expect(options).toMatchObject({ sort, onSortChange, multiSort: true })
  })

  it('enforces controlled filtering and normalizes proxy/remote names', () => {
    const columns = [{ key: 'name' }]
    const getValue = (row: Row): unknown => row.name
    const options = toGridFilteringOptions({
      columns,
      getValue,
      filters: { name: 'a' },
      proxy: { enabled: true },
      remoteFilter: true,
    })

    expect(options).toMatchObject({
      columns,
      getValue,
      filters: { name: 'a' },
      controlled: true,
      proxy: true,
      remote: true,
    })
  })
})
