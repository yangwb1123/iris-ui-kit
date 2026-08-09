import { IrisTable, type IrisTableColumn } from '@iris-ui-kit/react'

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
          max）——点击单元格进入编辑
        </p>
        <IrisTable
          bordered
          rowKey="id"
          editConfig={{ trigger: 'click' }}
          columns={editColumns}
          data={tableData}
        />
      </section>
    </div>
  )
}
