import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPlugin } from '@iris-ui-kit/core'
import { IrisProvider } from '../../provider'
import { IrisTable } from './Table'
import type { IrisTableColumn } from './types'

enableAutoUnmount(afterEach)

type Row = { id: number; name: string; age: number }

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

function tableProps(query: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return {
    columns,
    data: rows,
    rowKey: 'id',
    resizableColumns: true,
    pinnedDrag: true,
    views: { storage: false },
    proxyConfig: { query, pageSize: 10 },
    pagerConfig: { showTotal: true, pageSizes: [10, 20] },
  }
}

function surface(
  query: ReturnType<typeof vi.fn>,
  locale: string,
  messages?: Record<string, string>,
) {
  return mount(IrisProvider, {
    props: { locale, plugins: [tableLocalePlugin], messages },
    slots: { default: () => h(IrisTable, tableProps(query)) },
  })
}

describe('@iris-ui-kit/vue IrisTable i18n parity', () => {
  it('updates the supported table views, resize handles, and pager chrome after a locale switch', async () => {
    const query = vi.fn(async () => ({ rows, total: rows.length }))
    const wrapper = surface(query, 'en-US')
    await flushPromises()
    await nextTick()

    expect(wrapper.find('[data-iris-table-views]').attributes('aria-label')).toBe('Table views')
    expect(
      wrapper
        .find('[data-iris-table-resize-handle][data-column-key="age"]')
        .attributes('aria-label'),
    ).toBe('Resize Age')
    expect(wrapper.find('[data-iris-pinned-drag-handle]').attributes('aria-label')).toBe(
      'Adjust pinned column count at Name',
    )
    expect(wrapper.find('[data-iris-table-views] option[value=""]').text()).toBe('View name…')
    expect(wrapper.find('[data-iris-table-pager] nav').attributes('aria-label')).toBe('Pagination')

    await wrapper.setProps({ locale: 'zh-CN' })
    await flushPromises()
    await nextTick()
    expect(wrapper.find('[data-iris-table-views]').attributes('aria-label')).toBe('表格视图')
    expect(
      wrapper
        .find('[data-iris-table-resize-handle][data-column-key="age"]')
        .attributes('aria-label'),
    ).toBe('调整 Age 列宽')
    expect(wrapper.find('[data-iris-pinned-drag-handle]').attributes('aria-label')).toBe(
      '调整 Name 固定列数量',
    )
    expect(wrapper.find('[data-iris-table-views] option[value=""]').text()).toBe('视图名称…')
    expect(wrapper.find('[data-iris-table-pager] nav').attributes('aria-label')).toBe('分页')
  })

  it('uses a user message override over the plugin translation', () => {
    const query = vi.fn(async () => ({ rows, total: rows.length }))
    const wrapper = surface(query, 'zh-CN', {
      'table.views.label': 'Custom table views',
      'table.resizeColumn': 'Resize field {column}',
    })
    expect(wrapper.find('[data-iris-table-views]').attributes('aria-label')).toBe(
      'Custom table views',
    )
    expect(
      wrapper
        .find('[data-iris-table-resize-handle][data-column-key="age"]')
        .attributes('aria-label'),
    ).toBe('Resize field Age')
  })
})
