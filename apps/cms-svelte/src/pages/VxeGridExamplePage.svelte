<script lang="ts">
  import {
    IrisTable,
    type IrisTableColumn,
    type IrisTableProxyQueryParams,
  } from '@iris-ui-kit/svelte'

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

  // 行操作演示：本地响应式行列表 + toolbar 按钮直接增删（本框架无 React 专属
  // checkMethod，故以本地状态演示 insert/remove 语义）。
  let rowOpsData = $state<GridRow[]>([...tableData])
  function insertRow() {
    rowOpsData = [
      { id: 9000, name: 'Newbie', role: 'Test', sex: 'Man', age: 19, address: 'test abc' },
      ...rowOpsData,
    ]
  }
  function removeRow() {
    rowOpsData = rowOpsData.filter((r) => r.id !== 9000)
  }
</script>

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
    <IrisTable bordered resizableColumns rowKey="id" seq {columns} data={tableData} />
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
      rowKey="id"
      editConfig={{ trigger: 'click' }}
      columns={editColumns}
      data={tableData}
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
      proxyConfig={{ query: remoteQuery, remoteSort: true, pageSize: 8 }}
      {columns}
    />
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
      proxyConfig={{ query: remoteQuery, remoteFilter: true, pageSize: 8 }}
      {columns}
    />
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
      rowKey="id"
      selectable="multi"
      columns={[
        { key: 'name', title: 'Name' },
        { key: 'role', title: 'Role' },
        { key: 'age', title: 'Age', align: 'right' },
      ]}
      data={rowOpsData}
      toolbar={{
        buttons: [
          { key: 'insert', label: '新增行', onClick: insertRow },
          { key: 'remove', label: '删除末行', onClick: removeRow },
        ],
      }}
    />
  </section>
</div>
