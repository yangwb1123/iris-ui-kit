<script lang="ts">
  import { createPlugin, type IrisPlugin } from '@iris-ui-kit/core'
  import IrisProvider from '../../provider/IrisProvider.svelte'
  import IrisTable from './IrisTable.svelte'
  import type { IrisTableProxyConfig } from './types'

  type Row = { id: number; name: string; age: number }

  const rows: Row[] = [
    { id: 1, name: 'Alice', age: 1 },
    { id: 2, name: 'Bob', age: 3 },
  ]
  const columns = [
    { key: 'name', title: 'Name', pinned: 'left' as const },
    { key: 'age', title: 'Age' },
  ]
  const tableLocalePlugin: IrisPlugin = createPlugin({
    name: 'table-i18n-test',
    install(registry) {
      registry.registerMessages('zh-CN', {
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
        'table.views.delete': '删除视图',
      })
    },
  })

  let {
    locale = 'en-US',
    messages,
    query,
  }: {
    locale?: string
    messages?: Record<string, string>
    query: IrisTableProxyConfig['query']
  } = $props()
</script>

<IrisProvider {locale} plugins={[tableLocalePlugin]} {messages}>
  <IrisTable
    {columns}
    data={rows}
    rowKey="id"
    resizableColumns
    pinnedDrag
    views={{ storage: false }}
    proxyConfig={{ query, pageSize: 10 }}
    pagerConfig={{ showTotal: true, pageSizes: [10, 20] }}
  />
</IrisProvider>
