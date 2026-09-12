import { useRef, useState, type MutableRefObject } from 'react'
import {
  downloadCsv,
  IrisTable,
  type IrisTableColumn,
  type IrisTableColumnWidths,
  type IrisTableHandle,
  type IrisTableProps,
  type IrisTableProxyQueryParams,
} from '@iris-ui-kit/react'

/**
 * The official vxe-grid "basic usage" example, implemented with IrisTable.
 *
 * Source: https://vxetable.cn — vxe-grid 基础用法（配置式 gridOptions）
 * 对照：
 *   vxe-grid 配置          → IrisTable prop
 *   ─────────────────────   ────────────────────────
 *   border: true           → bordered
 *   showOverflow: true     → 单元格默认 ellipsis
 *   columnConfig.resizable → resizableColumnsColumns
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

const columns: IrisTableColumn<GridRow>[] = [
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

function ControlledColumnWidthsDemo() {
  const [columnWidths, setColumnWidths] = useState<IrisTableColumnWidths>({ name: 200 })

  return (
    <section data-iris-vxe-section="controlled-column-widths">
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
        受控列宽（Controlled column widths）
      </h2>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 'var(--iris-font-size-sm, 13px)',
          color: 'var(--iris-muted)',
        }}
      >
        父组件持有完整列宽映射；聚焦 Name 列右侧手柄并使用方向键，表格会用新宽度重新渲染。
      </p>
      <IrisTable
        bordered
        resizableColumns
        rowKey="id"
        columns={controlledColumnWidthsColumns}
        data={controlledColumnWidthsData}
        columnWidths={columnWidths}
        onColumnWidthsChange={(next) => setColumnWidths(next)}
      />
      <output
        data-iris-vxe-column-widths-readout
        aria-live="polite"
        style={{
          display: 'block',
          marginTop: 12,
          padding: '8px 12px',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          color: 'var(--iris-muted)',
          fontSize: 'var(--iris-font-size-sm, 13px)',
        }}
      >
        {JSON.stringify(columnWidths)}
      </output>
    </section>
  )
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

const groupedSummaryColumns: IrisTableColumn<GroupedSummaryRow>[] = [
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

interface FilterValuesRow extends Record<string, unknown> {
  id: number
  name: string
  status: string
}

const filterValuesRows: FilterValuesRow[] = [
  { id: 40001, name: 'Active row', status: 'active' },
  { id: 40002, name: 'Paused row', status: 'paused' },
  { id: 40003, name: 'Inactive row', status: 'inactive' },
]

const filterValuesColumns: IrisTableColumn<FilterValuesRow>[] = [
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

type RetryProxyConfig = NonNullable<IrisTableProps<GridRow>['proxyConfig']>

interface MaskedContactRow extends Record<string, unknown> {
  id: number
  name: string
  phone: string
  team: string
}

const maskedContactRows: MaskedContactRow[] = [
  { id: 1, name: 'Alexandra', phone: '13812345678', team: 'Platform' },
  { id: 2, name: 'Bob', phone: '13900001111', team: 'Design' },
]

const maskedContactColumns: IrisTableColumn<MaskedContactRow>[] = [
  { key: 'name', title: 'Name' },
  { key: 'phone', title: 'Phone', mask: 'sensitive' },
  { key: 'team', title: 'Team' },
]

/** 官方行编辑示例（editConfig + editRules，click 触发 + 必填）。 */
const editColumns: IrisTableColumn<GridRow>[] = [
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
function remoteQuery(params: {
  page: number
  pageSize: number
  sort: { key: string; direction: 'asc' | 'desc' } | null
  filters: Record<string, string>
}): Promise<{ rows: GridRow[]; total: number }> {
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

function RetryProxyDemo() {
  const retryAttempt = useRef(0)
  const retryQuery = (
    _params: IrisTableProxyQueryParams,
  ): Promise<{ rows: GridRow[]; total: number }> => {
    const attempt = retryAttempt.current
    retryAttempt.current += 1
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

  const retryProxyConfig: RetryProxyConfig = {
    query: retryQuery,
    autoLoad: true,
    pageSize: 10,
  }

  return (
    <section>
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
        代理错误与重试（Proxy error + retry）
      </h2>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 'var(--iris-font-size-sm, 13px)',
          color: 'var(--iris-muted)',
        }}
      >
        首次请求固定延迟 400ms 后故意失败；点击内置 Retry 会再次请求；重试成功返回 1 条名为
        RetrySuccess 的数据。
      </p>
      <IrisTable bordered rowKey="id" seq proxyConfig={retryProxyConfig} columns={columns} />
    </section>
  )
}

function CurrentRowColumnDemo() {
  const [currentRowKey, setCurrentRowKey] = useState<string | number>(10001)
  const [currentColumnKey, setCurrentColumnKey] = useState('name')

  return (
    <section data-iris-vxe-section="current-row-column">
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
        受控当前行/列（Controlled current row/column）
      </h2>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 'var(--iris-font-size-sm, 13px)',
          color: 'var(--iris-muted)',
        }}
      >
        点击数据行或列头会通过专用回调更新受控的当前行和当前列状态；两个高亮彼此独立。
      </p>
      <IrisTable
        bordered
        rowKey="id"
        columns={columns}
        data={tableData}
        currentRowKey={currentRowKey}
        currentColumnKey={currentColumnKey}
        onCurrentRowChange={(key) => setCurrentRowKey(key)}
        onCurrentColumnChange={(key) => setCurrentColumnKey(key)}
      />
      <div
        data-iris-vxe-current-readout
        aria-live="polite"
        style={{
          marginTop: 12,
          padding: '8px 12px',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          color: 'var(--iris-muted)',
          fontSize: 'var(--iris-font-size-sm, 13px)',
        }}
      >
        currentRowKey: {currentRowKey}; currentColumnKey: {currentColumnKey}
      </div>
    </section>
  )
}

function ControlledFilterValuesDemo() {
  const [filterValues, setFilterValues] = useState<Record<string, string[]>>({})

  return (
    <section data-iris-vxe-section="filter-values">
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
        受控列筛选值（Controlled filter values + OR matching）
      </h2>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 'var(--iris-font-size-sm, 13px)',
          color: 'var(--iris-muted)',
        }}
      >
        父组件控制 Status 的勾选值；同时选择 Active 与 Paused 时按 OR 匹配，清除后恢复全部行。
      </p>
      <IrisTable
        bordered
        rowKey="id"
        columns={filterValuesColumns}
        data={filterValuesRows}
        filterValues={filterValues}
        onFilterValuesChange={setFilterValues}
      />
      <output
        data-iris-vxe-filter-values-readout
        aria-live="polite"
        style={{
          display: 'block',
          marginTop: 12,
          padding: '8px 12px',
          border: '1px solid var(--iris-border)',
          borderRadius: 'var(--iris-radius-md, 6px)',
          color: 'var(--iris-muted)',
          fontSize: 'var(--iris-font-size-sm, 13px)',
        }}
      >
        filterValues: {JSON.stringify(filterValues)}
      </output>
    </section>
  )
}

export function VxeGridExamplePage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 960 }}>
      <section>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
          vxe-grid 基础用法（Basic usage）
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            color: 'var(--iris-muted)',
          }}
        >
          官方示例对照：border / showOverflow / resizable / keyField / seq / sortable
        </p>
        <IrisTable bordered resizableColumns rowKey="id" seq columns={columns} data={tableData} />
      </section>

      <ControlledColumnWidthsDemo />

      <section data-iris-vxe-section="grouped-summary">
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
          分组表头与汇总行（Grouped headers + summary row）
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            color: 'var(--iris-muted)',
          }}
        >
          Two fixed teams demonstrate a Metrics group with built-in Planned/Actual sums.
        </p>
        <IrisTable bordered rowKey="id" columns={groupedSummaryColumns} data={groupedSummaryRows} />
      </section>

      <section>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
          行编辑（Row editing）
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            color: 'var(--iris-muted)',
          }}
        >
          官方示例对照：editConfig（trigger: click）+ editRules（required / type / min /
          max）——点击单元格进入编辑；提交后数据自动回写保留（无需父组件更新）
        </p>
        <IrisTable
          bordered
          rowKey="id"
          editConfig={{ trigger: 'click' }}
          columns={editColumns}
          data={tableData}
        />
      </section>

      <CurrentRowColumnDemo />

      <section>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
          服务端数据源（Server-side data source）
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            color: 'var(--iris-muted)',
          }}
        >
          官方示例对照：proxyConfig（autoLoad / remoteSort / 分页）——43 条数据、 每页 8
          条；点击表头排序或翻页都会重新请求（模拟 400ms 延迟展示 loading），远程模式不做本地排序
        </p>
        <IrisTable
          bordered
          rowKey="id"
          seq
          toolbar={{
            title: 'Server table',
            onRefresh: () => {},
            buttons: [
              {
                key: 'row-count',
                label: `共 ${serverData.length} 条`,
                onClick: () => {},
              },
            ],
          }}
          proxyConfig={{
            query: remoteQuery,
            remoteSort: true,
            pageSize: 8,
          }}
          columns={columns}
        />
      </section>

      <RetryProxyDemo />

      <section>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
          搜索表单（Search form）
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            color: 'var(--iris-muted)',
          }}
        >
          官方示例对照：formConfig——表格上方搜索区；提交将表单值合并进远程查询 filters 并重置到第 1
          页（服务端筛选），重置清空并重新查询
        </p>
        <IrisTable
          bordered
          rowKey="id"
          formConfig={{
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
          }}
          proxyConfig={{
            query: remoteQuery,
            remoteFilter: true,
            pageSize: 8,
          }}
          columns={columns}
        />
      </section>

      <ControlledFilterValuesDemo />

      <section>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
          行操作 + 勾选条件（Row ops + checkMethod）
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            color: 'var(--iris-muted)',
          }}
        >
          官方示例对照：insertRow/removeRow（tableRef 方法）+ checkboxConfig.checkMethod （age &lt;
          20 的行不可勾选，全选自动跳过）
        </p>
        <RowOpsDemo />
      </section>

      <section>
        <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
          内容自适应行高（adaptiveRowHeight，iris 独有）
        </h2>
        <p
          style={{
            margin: '0 0 12px',
            fontSize: 'var(--iris-font-size-sm, 13px)',
            color: 'var(--iris-muted)',
          }}
        >
          无固定 rowHeight 时数据行按内容换行自增长——vxe autoHeight
          是撑满视口，不释放单元格换行。下方按钮提交更长
          文本：真实浏览器里旧钉住高度会被再次测量为自然高度（clamp-trap 自愈），行随之变高
        </p>
        <AdaptiveHeightDemo />
      </section>

      <MaskedExportDemo />
    </div>
  )
}

/** 行操作演示：toolbar 按钮触发 tableRef.insertRow，checkMethod 禁用低龄行。 */
function RowOpsDemo() {
  const tableRef = useRef<IrisTableHandle<GridRow> | null>(null)
  const rowOpsColumns: IrisTableColumn<GridRow>[] = [
    { key: 'name', title: 'Name' },
    { key: 'role', title: 'Role' },
    { key: 'age', title: 'Age', align: 'right' },
  ]
  return (
    <IrisTable
      bordered
      rowKey="id"
      selectable="multi"
      tableRef={tableRef as MutableRefObject<IrisTableHandle<GridRow> | null>}
      checkMethod={(row) => (row.age as number) >= 20}
      toolbar={{
        buttons: [
          {
            key: 'insert',
            label: '新增行',
            onClick: () =>
              tableRef.current?.insertRow({
                id: 9000,
                name: 'Newbie',
                role: 'Test',
                sex: 'Man',
                age: 19,
                address: 'test abc',
              }),
          },
          {
            key: 'remove',
            label: '删除末行',
            onClick: () => tableRef.current?.removeRow(9000),
          },
        ],
      }}
      columns={rowOpsColumns}
      data={tableData}
    />
  )
}

/** Batch EC 真实浏览器验证区：`adaptiveRowHeight` 表格——短行 vs 多行文本行高差异，
 * 增长按钮 commit 更长内容后旧钉住高度被重测为自然高度（clamp-trap 自愈）。
 * Playwright 规格断言行高差异 + 增长自愈 + 表头保持单行。 */
function AdaptiveHeightDemo() {
  const [note, setNote] = useState('短文本')
  const adaptiveRows: GridRow[] = [
    { id: 1, name: 'Short', role: '-', sex: '-', age: 1, address: note },
    {
      id: 2,
      name: 'Tall',
      role: '-',
      sex: '-',
      age: 2,
      address:
        'Long content that wraps across multiple lines in a real browser — the row grows to show it all instead of clipping to one line.',
    },
  ]
  const adaptiveColumns: IrisTableColumn<GridRow>[] = [
    { key: 'name', title: 'Name' },
    { key: 'address', title: 'Note' },
  ]
  return (
    <div>
      <button
        type="button"
        data-iris-adaptive-grow
        onClick={() =>
          setNote(
            'Now this cell holds a much longer paragraph that wraps onto several lines — the row must re-measure to its natural height instead of keeping the old shorter pin.',
          )
        }
      >
        增长第 1 行内容（grow row 1）
      </button>
      <IrisTable
        bordered
        rowKey="id"
        adaptiveRowHeight
        data={adaptiveRows}
        columns={adaptiveColumns}
      />
    </div>
  )
}

function MaskedExportDemo() {
  const tableRef = useRef<IrisTableHandle<MaskedContactRow> | null>(null)
  const [downloadStatus, setDownloadStatus] = useState('尚未下载')

  const handleDownload = () => {
    if (!tableRef.current) {
      setDownloadStatus('表格尚未就绪')
      return
    }
    setDownloadStatus('下载中')
    const csv = tableRef.current.exportCurrentViewCsv()
    void downloadCsv('masked-contacts.csv', csv).then(
      () => setDownloadStatus('已下载 masked-contacts.csv'),
      () => setDownloadStatus('下载失败，请重试'),
    )
  }

  return (
    <section data-iris-vxe-section="masked-export">
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--iris-font-size-lg, 16px)' }}>
        敏感信息导出（Masked export）
      </h2>
      <p
        style={{
          margin: '0 0 12px',
          fontSize: 'var(--iris-font-size-sm, 13px)',
          color: 'var(--iris-muted)',
        }}
      >
        Phone 列使用敏感信息脱敏；下载按钮通过表格 handle 导出当前视图，CSV 与表格显示保持一致。
      </p>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <button type="button" onClick={handleDownload}>
          下载脱敏 CSV
        </button>
        <span aria-live="polite" style={{ color: 'var(--iris-muted)' }}>
          {downloadStatus}
        </span>
      </div>
      <IrisTable
        bordered
        rowKey="id"
        tableRef={tableRef}
        columns={maskedContactColumns}
        data={maskedContactRows}
      />
    </section>
  )
}
