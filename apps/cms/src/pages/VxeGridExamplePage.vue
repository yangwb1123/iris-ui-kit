<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IrisTable,
  type IrisTableColumn,
  type IrisTableColumnWidths,
  type IrisTableProxyConfig,
  type IrisTableProxyQueryParams,
} from '@iris-ui-kit/vue'

/**
 * vxe-grid 官方示例的 IrisTable 实现（与 apps/cms-react 同款对照页）。
 *
 * Source: https://vxetable.cn — vxe-grid 基础用法（配置式 gridOptions）
 * 对照：
 *   vxe-grid 配置          → IrisTable prop
 *   ─────────────────────   ────────────────────────
 *   border: true           → bordered
 *   showOverflow: true     → 单元格默认 ellipsis
 *   columnConfig.resizable → resizableColumns
 *   rowConfig.keyField     → rowKey
 *   columns[{type:'seq'}]  → seq
 *   columns[{sortable}]    → columns[].sortable
 *   editConfig/trigger     → editConfig={{ trigger: 'click' }}
 *   editRules              → columns[].editRules
 *   proxyConfig            → proxyConfig={{ query, remoteSort, pageSize }}
 *   formConfig             → formConfig={{ fields, submitText, resetText }}
 */

interface GridRow {
  id: number
  name: string
  role: string
  sex: string
  age: number
  address: string
  [key: string]: unknown
}

/** 与官方示例完全一致的演示数据。 */
const tableData: GridRow[] = [
  { id: 10001, name: 'Test1', role: 'Develop', sex: 'Man', age: 28, address: 'test abc' },
  { id: 10002, name: 'Test2', role: 'Test', sex: 'Women', age: 22, address: 'Guangzhou' },
  { id: 10003, name: 'Test3', role: 'PM', sex: 'Man', age: 32, address: 'Shanghai' },
  { id: 10004, name: 'Test4', role: 'Designer', sex: 'Women', age: 24, address: 'test abc' },
  { id: 10005, name: 'Test5', role: 'Develop', sex: 'Man', age: 30, address: 'Shanghai' },
  { id: 10006, name: 'Test6', role: 'Test', sex: 'Women', age: 26, address: 'test abc' },
]

const columns: IrisTableColumn[] = [
  { key: 'name', title: 'Name', sortable: true },
  { key: 'role', title: 'Role' },
  { key: 'sex', title: 'Sex' },
  { key: 'age', title: 'Age', sortable: true, align: 'right' },
  { key: 'address', title: 'Address' },
]

const controlledColumnWidthsColumns: IrisTableColumn[] = [
  { key: 'name', title: 'Name' },
  { key: 'age', title: 'Age' },
]

const controlledColumnWidthsData: Array<Record<string, unknown>> = [
  { id: '1', name: 'Charlie', age: 30 },
  { id: '2', name: 'Alpha', age: 25 },
  { id: '3', name: 'Bravo', age: 35 },
]

const columnWidths = ref<IrisTableColumnWidths>({ name: 200 })

function handleControlledColumnWidthsChange(next: IrisTableColumnWidths): void {
  columnWidths.value = next
}

interface GroupedSummaryRow extends Record<string, unknown> {
  id: number
  label: string
  planned: number
  actual: number
}

const groupedSummaryRows: GroupedSummaryRow[] = [
  { id: 1, label: 'North', planned: 10, actual: 20 },
  { id: 2, label: 'South', planned: 20, actual: 40 },
]

const groupedSummaryColumns: IrisTableColumn[] = [
  { key: 'label', title: 'Team' },
  {
    key: 'metrics',
    title: 'Metrics',
    children: [
      { key: 'planned', title: 'Planned', summary: 'sum' },
      { key: 'actual', title: 'Actual', summary: 'sum' },
    ],
  },
]

const filterValuesRows: Array<Record<string, unknown>> = [
  { id: 40001, name: 'Active row', status: 'active' },
  { id: 40002, name: 'Paused row', status: 'paused' },
  { id: 40003, name: 'Inactive row', status: 'inactive' },
]

const filterValuesColumns: IrisTableColumn[] = [
  { key: 'name', title: 'Name' },
  {
    key: 'status',
    title: 'Status',
    filterable: true,
    filterOptions: [
      { value: 'active', label: 'Active' },
      { value: 'paused', label: 'Paused' },
    ],
  },
]

/** 官方行编辑示例（editConfig + editRules，click 触发 + 必填）。 */
const editColumns: IrisTableColumn[] = [
  {
    key: 'name',
    title: 'Name',
    editable: true,
    editRules: [{ required: true, message: 'name 必填' }],
  },
  { key: 'role', title: 'Role', editable: true },
  { key: 'sex', title: 'Sex', editable: true },
  {
    key: 'age',
    title: 'Age',
    align: 'right',
    editable: true,
    editor: 'number',
    editRules: [{ type: 'number', min: 1, max: 150, message: 'age 需为 1–150 的数字' }],
  },
  { key: 'address', title: 'Address', editable: true },
]

/** 服务端数据集（43 条，跨 6 页）。 */
const serverData: GridRow[] = Array.from({ length: 43 }, (_, i) => {
  const n = i + 1
  const roles = ['Develop', 'Test', 'PM', 'Designer']
  return {
    id: 10000 + n,
    name: `Test${n}`,
    role: roles[i % roles.length]!,
    sex: n % 2 === 0 ? 'Women' : 'Man',
    age: 20 + (n % 25),
    address: ['test abc', 'Guangzhou', 'Shanghai', 'Beijing'][i % 4]!,
  }
})

/**
 * 模拟远程查询（vxe-grid proxyConfig.ajax.query 对照）：400ms 延迟 +
 * 服务端排序 + 分页切片。真实场景这里换成 HTTP 请求即可。
 */
function remoteQuery(
  params: IrisTableProxyQueryParams,
): Promise<{ rows: GridRow[]; total: number }> {
  return new Promise((resolve) => {
    setTimeout(() => {
      let rows = [...serverData]
      // 服务端筛选（formConfig/proxyConfig filters 对照）
      const f = params.filters ?? {}
      if (f.name) rows = rows.filter((r) => r.name.toLowerCase().includes(f.name.toLowerCase()))
      if (f.role) rows = rows.filter((r) => r.role === f.role)
      if (params.sort) {
        const { key, direction } = params.sort
        const dir = direction === 'asc' ? 1 : -1
        rows.sort((a, b) => {
          const va = a[key] ?? ''
          const vb = b[key] ?? ''
          return (va < vb ? -1 : va > vb ? 1 : 0) * dir
        })
      }
      const start = (params.page - 1) * params.pageSize
      resolve({ rows: rows.slice(start, start + params.pageSize), total: rows.length })
    }, 400)
  })
}

let retryAttempt = 0

/** Deliberately fails once so the built-in IrisTable proxy retry is visible. */
function retryQuery(): Promise<{ rows: GridRow[]; total: number }> {
  const attempt = retryAttempt
  retryAttempt += 1
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (attempt === 0) {
        reject(new Error('Intentional proxy failure'))
        return
      }
      resolve({
        rows: [
          {
            id: 20001,
            name: 'RetrySuccess',
            role: 'Recovery',
            sex: '—',
            age: 1,
            address: 'retry complete',
          },
        ],
        total: 1,
      })
    }, 400)
  })
}

const retryProxyConfig: IrisTableProxyConfig<GridRow> = {
  query: retryQuery,
  autoLoad: true,
  pageSize: 10,
}

// 行操作演示：本地响应式行列表 + toolbar 按钮直接增删（本框架无 React 专属
// checkMethod，故以本地状态演示 insert/remove 语义）。
const rowOpsData = ref<GridRow[]>([...tableData])
function insertRow() {
  rowOpsData.value = [
    { id: 9000, name: 'Newbie', role: 'Test', sex: 'Man', age: 19, address: 'test abc' },
    ...rowOpsData.value,
  ]
}
function removeRow() {
  rowOpsData.value = rowOpsData.value.filter((r) => r.id !== 9000)
}

const filterValues = ref<Record<string, string[]>>({})

function handleFilterValuesChange(next: Record<string, string[]>): void {
  filterValues.value = next
}

const columnDragColumns = ref<IrisTableColumn[]>([
  { key: 'name', title: 'Name' },
  { key: 'role', title: 'Role' },
  { key: 'age', title: 'Age', align: 'right' },
])
const columnDragData: Array<Record<string, unknown>> = [
  { id: 30001, name: 'DragName', role: 'DragRole', age: 42 },
]
const columnDragOrder = computed(() =>
  columnDragColumns.value.map((column) => column.title).join(', '),
)
function handleColumnReorder(nextColumns: IrisTableColumn[]) {
  columnDragColumns.value = nextColumns
}
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 24px; max-width: 960px">
    <section>
      <h2 style="margin: 0 0 4px; font-size: var(--iris-font-size-lg, 16px)">
        vxe-grid 基础用法（Basic usage）
      </h2>
      <p
        style="
          margin: 0 0 12px;
          font-size: var(--iris-font-size-sm, 13px);
          color: var(--iris-muted);
        "
      >
        官方示例对照：border / showOverflow / resizable / keyField / seq / sortable
      </p>
      <IrisTable bordered resizable-columns row-key="id" seq :columns="columns" :data="tableData" />
    </section>

    <section data-iris-vxe-section="controlled-column-widths">
      <h2 style="margin: 0 0 4px; font-size: var(--iris-font-size-lg, 16px)">
        受控列宽（Controlled column widths）
      </h2>
      <p
        style="
          margin: 0 0 12px;
          font-size: var(--iris-font-size-sm, 13px);
          color: var(--iris-muted);
        "
      >
        父组件持有完整列宽映射；聚焦 Name 列右侧手柄并使用方向键，表格会用新宽度重新渲染。
      </p>
      <IrisTable
        bordered
        resizable-columns
        row-key="id"
        :columns="controlledColumnWidthsColumns"
        :data="controlledColumnWidthsData"
        :column-widths="columnWidths"
        @update:columnWidths="handleControlledColumnWidthsChange"
      />
      <output
        data-iris-vxe-column-widths-readout
        aria-live="polite"
        style="
          display: block;
          margin-top: 12px;
          padding: 8px 12px;
          border: 1px solid var(--iris-border);
          border-radius: var(--iris-radius-md, 6px);
          color: var(--iris-muted);
          font-size: var(--iris-font-size-sm, 13px);
        "
        >{{ JSON.stringify(columnWidths) }}</output
      >
    </section>

    <section data-iris-vxe-section="grouped-summary">
      <h2 style="margin: 0 0 4px; font-size: var(--iris-font-size-lg, 16px)">
        分组表头与汇总行（Grouped headers + summary row）
      </h2>
      <p
        style="
          margin: 0 0 12px;
          font-size: var(--iris-font-size-sm, 13px);
          color: var(--iris-muted);
        "
      >
        Two fixed teams demonstrate a Metrics group with built-in Planned/Actual sums.
      </p>
      <IrisTable
        bordered
        row-key="id"
        :columns="groupedSummaryColumns"
        :data="groupedSummaryRows"
      />
    </section>

    <section>
      <h2 style="margin: 0 0 4px; font-size: var(--iris-font-size-lg, 16px)">
        行编辑（Row editing）
      </h2>
      <p
        style="
          margin: 0 0 12px;
          font-size: var(--iris-font-size-sm, 13px);
          color: var(--iris-muted);
        "
      >
        官方示例对照：editConfig（trigger: click）+ editRules（required / type / min /
        max）——点击单元格进入编辑；提交后数据自动回写保留（无需父组件更新）
      </p>
      <IrisTable
        bordered
        row-key="id"
        :edit-config="{ trigger: 'click' }"
        :columns="editColumns"
        :data="tableData"
      />
    </section>

    <section>
      <h2 style="margin: 0 0 4px; font-size: var(--iris-font-size-lg, 16px)">
        服务端数据源（Server-side data source）
      </h2>
      <p
        style="
          margin: 0 0 12px;
          font-size: var(--iris-font-size-sm, 13px);
          color: var(--iris-muted);
        "
      >
        官方示例对照：proxyConfig（autoLoad / remoteSort / 分页）——43 条数据、 每页 8
        条；点击表头排序或翻页都会重新请求（模拟 400ms 延迟展示 loading），远程模式不做本地排序
      </p>
      <IrisTable
        bordered
        row-key="id"
        seq
        :toolbar="{
          title: 'Server table',
          onRefresh: () => {},
          buttons: [{ key: 'row-count', label: `共 ${serverData.length} 条`, onClick: () => {} }],
        }"
        :proxy-config="{ query: remoteQuery, remoteSort: true, pageSize: 8 }"
        :columns="columns"
      />
    </section>

    <section>
      <h2 style="margin: 0 0 4px; font-size: var(--iris-font-size-lg, 16px)">
        代理错误与重试（Proxy error + retry）
      </h2>
      <p
        style="
          margin: 0 0 12px;
          font-size: var(--iris-font-size-sm, 13px);
          color: var(--iris-muted);
        "
      >
        首次请求固定延迟 400ms 后故意失败；点击内置 Retry 会再次请求并成功返回 1 条数据。
      </p>
      <IrisTable bordered row-key="id" seq :proxy-config="retryProxyConfig" :columns="columns" />
    </section>

    <section>
      <h2 style="margin: 0 0 4px; font-size: var(--iris-font-size-lg, 16px)">
        搜索表单（Search form）
      </h2>
      <p
        style="
          margin: 0 0 12px;
          font-size: var(--iris-font-size-sm, 13px);
          color: var(--iris-muted);
        "
      >
        官方示例对照：formConfig——表格上方搜索区；提交将表单值合并进远程查询 filters 并重置到第 1
        页（服务端筛选），重置清空并重新查询
      </p>
      <IrisTable
        bordered
        row-key="id"
        :form-config="{
          fields: [
            { key: 'name', label: 'Name', type: 'text', placeholder: 'Test2' },
            {
              key: 'role',
              label: 'Role',
              type: 'select',
              options: [
                { value: '', label: '全部' },
                { value: 'Develop', label: 'Develop' },
                { value: 'Test', label: 'Test' },
                { value: 'PM', label: 'PM' },
                { value: 'Designer', label: 'Designer' },
              ],
            },
          ],
          submitText: '查询',
          resetText: '重置',
        }"
        :proxy-config="{ query: remoteQuery, remoteFilter: true, pageSize: 8 }"
        :columns="columns"
      />
    </section>

    <section data-iris-vxe-section="filter-values">
      <h2 style="margin: 0 0 4px; font-size: var(--iris-font-size-lg, 16px)">
        受控列筛选值（Controlled filter values + OR matching）
      </h2>
      <p
        style="
          margin: 0 0 12px;
          font-size: var(--iris-font-size-sm, 13px);
          color: var(--iris-muted);
        "
      >
        父组件控制 Status 的勾选值；同时选择 Active 与 Paused 时按 OR 匹配，清除后恢复全部行。
      </p>
      <IrisTable
        bordered
        row-key="id"
        :columns="filterValuesColumns"
        :data="filterValuesRows"
        :filter-values="filterValues"
        :on-filter-values-change="handleFilterValuesChange"
      />
      <output
        data-iris-vxe-filter-values-readout
        aria-live="polite"
        style="
          display: block;
          margin-top: 12px;
          padding: 8px 12px;
          border: 1px solid var(--iris-border);
          border-radius: var(--iris-radius-md, 6px);
          color: var(--iris-muted);
          font-size: var(--iris-font-size-sm, 13px);
        "
      >
        filterValues: {{ JSON.stringify(filterValues) }}
      </output>
    </section>

    <section>
      <h2 style="margin: 0 0 4px; font-size: var(--iris-font-size-lg, 16px)">行操作（Row ops）</h2>
      <p
        style="
          margin: 0 0 12px;
          font-size: var(--iris-font-size-sm, 13px);
          color: var(--iris-muted);
        "
      >
        官方示例对照：insertRow/removeRow（toolbar 按钮）——新增行插到表头，删除末行；勾选条件
        checkMethod 为 React 专属 prop，本框架以本地状态实现行增删
      </p>
      <IrisTable
        bordered
        row-key="id"
        selectable="multi"
        :columns="[
          { key: 'name', title: 'Name' },
          { key: 'role', title: 'Role' },
          { key: 'age', title: 'Age', align: 'right' },
        ]"
        :data="rowOpsData"
        :toolbar="{
          buttons: [
            { key: 'insert', label: '新增行', onClick: insertRow },
            { key: 'remove', label: '删除末行', onClick: removeRow },
          ],
        }"
      />
    </section>

    <section>
      <h2 style="margin: 0 0 4px; font-size: var(--iris-font-size-lg, 16px)">
        列拖拽排序（Column drag ordering）
      </h2>
      <p
        style="
          margin: 0 0 12px;
          font-size: var(--iris-font-size-sm, 13px);
          color: var(--iris-muted);
        "
      >
        拖动 Name 表头到 Age；父组件通过 columnDrag.onReorder 接收并重新提供列顺序。
      </p>
      <p
        data-iris-vxe-column-order
        aria-live="polite"
        style="margin: 0 0 12px; font-size: var(--iris-font-size-sm, 13px)"
      >
        当前列顺序：{{ columnDragOrder }}
      </p>
      <IrisTable
        bordered
        row-key="id"
        :columns="columnDragColumns"
        :data="columnDragData"
        :column-drag="{ onReorder: handleColumnReorder }"
      />
    </section>
  </div>
</template>
