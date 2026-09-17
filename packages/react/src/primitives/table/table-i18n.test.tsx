import * as React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { createPlugin } from '@iris-ui-kit/core'
import { IrisProvider } from '../../provider'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

afterEach(cleanup)

interface Row extends Record<string, unknown> {
  id: number
  name: string
  age: number
}

const rows: Row[] = [
  { id: 1, name: 'Alice', age: 1 },
  { id: 2, name: 'Bob', age: 3 },
]

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name', pinned: 'left' },
  { key: 'age', title: 'Age' },
]

const zhTableMessages: Record<string, string> = {
  'pagination.label': '分页',
  'pagination.previous': '上一页',
  'pagination.next': '下一页',
  'pagination.page': '第 {page} 页',
  'table.resizeColumn': '调整 {column} 列宽',
  'table.resizePinned': '调整 {column} 固定列数量',
  'table.headerStats': '数量 {count}，平均值 {average}',
  'table.headerStatsShort': '数量={count} · 平均={average}',
  'table.page': '页',
  'table.pageSize': '每页数量',
  'table.total': '共 {total} 条',
  'table.views.label': '表格视图',
  'table.views.placeholder': '视图名称…',
  'table.views.save': '保存视图',
}

const tableLocalePlugin = createPlugin({
  name: 'table-i18n-test',
  install(registry) {
    registry.registerMessages('zh-CN', zhTableMessages)
  },
})

function table(query: ReturnType<typeof vi.fn>): React.ReactElement {
  return (
    <IrisTable
      columns={columns}
      data={rows}
      rowKey="id"
      headerStats
      resizableColumns
      pinnedDrag
      views={{ storage: false }}
      proxyConfig={{ query, pageSize: 10 }}
      pagerConfig={{ showTotal: true, pageSizes: [10, 20] }}
    />
  )
}

function tableSurface(
  query: ReturnType<typeof vi.fn>,
  locale: string,
  messages?: Record<string, string>,
) {
  return (
    <IrisProvider locale={locale} plugins={[tableLocalePlugin]} messages={messages}>
      {table(query)}
    </IrisProvider>
  )
}

describe('@iris-ui-kit/react IrisTable i18n parity', () => {
  it('updates table views, resize handles, header stats, and pager chrome after a locale switch', async () => {
    const query = vi.fn(async () => ({ rows, total: rows.length }))
    const { container, rerender } = render(tableSurface(query, 'en-US'))

    await waitFor(() =>
      expect(container.querySelector('[data-iris-table-cell="age"]')).not.toBeNull(),
    )
    expect(container.querySelector('[data-iris-table-views]')?.getAttribute('aria-label')).toBe(
      'Table views',
    )
    expect(
      container
        .querySelector('[data-iris-table-resize-handle][data-column-key="age"]')
        ?.getAttribute('aria-label'),
    ).toBe('Resize Age')
    expect(
      container.querySelector('[data-iris-pinned-drag-handle]')?.getAttribute('aria-label'),
    ).toBe('Adjust pinned column count at Name')
    expect(container.querySelector('[data-iris-header-stats]')?.getAttribute('aria-label')).toBe(
      'Count 2, average 2.00',
    )
    expect(container.querySelector('[data-iris-header-stats]')?.textContent).toBe('n=2 · avg=2.00')
    expect(container.querySelector('[data-iris-table-views] option[value=""]')?.textContent).toBe(
      'View name…',
    )
    expect(
      container
        .querySelector('[data-iris-table-pager] [data-iris-select-trigger]')
        ?.getAttribute('aria-label'),
    ).toBe('Page size')
    expect(container.querySelector('[data-iris-table-pager] nav')?.getAttribute('aria-label')).toBe(
      'Pagination',
    )

    rerender(tableSurface(query, 'zh-CN'))
    await waitFor(() =>
      expect(container.querySelector('[data-iris-table-views]')?.getAttribute('aria-label')).toBe(
        '表格视图',
      ),
    )
    expect(
      container
        .querySelector('[data-iris-table-resize-handle][data-column-key="age"]')
        ?.getAttribute('aria-label'),
    ).toBe('调整 Age 列宽')
    expect(
      container.querySelector('[data-iris-pinned-drag-handle]')?.getAttribute('aria-label'),
    ).toBe('调整 Name 固定列数量')
    expect(container.querySelector('[data-iris-header-stats]')?.getAttribute('aria-label')).toBe(
      '数量 2，平均值 2.00',
    )
    expect(container.querySelector('[data-iris-header-stats]')?.textContent).toBe(
      '数量=2 · 平均=2.00',
    )
    expect(container.querySelector('[data-iris-table-views] option[value=""]')?.textContent).toBe(
      '视图名称…',
    )
    expect(
      container
        .querySelector('[data-iris-table-pager] [data-iris-select-trigger]')
        ?.getAttribute('aria-label'),
    ).toBe('每页数量')
    expect(container.querySelector('[data-iris-table-pager] nav')?.getAttribute('aria-label')).toBe(
      '分页',
    )
  })

  it('lets user messages override plugin table translations', () => {
    const query = vi.fn(async () => ({ rows, total: rows.length }))
    const { container } = render(
      tableSurface(query, 'zh-CN', {
        'table.views.label': 'Custom table views',
        'table.resizeColumn': 'Resize field {column}',
      }),
    )
    expect(container.querySelector('[data-iris-table-views]')?.getAttribute('aria-label')).toBe(
      'Custom table views',
    )
    expect(
      container
        .querySelector('[data-iris-table-resize-handle][data-column-key="age"]')
        ?.getAttribute('aria-label'),
    ).toBe('Resize field Age')
  })
})
