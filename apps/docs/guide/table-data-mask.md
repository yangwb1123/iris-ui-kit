# Table data mask

Iris UI 独有的能力 — vxe-grid 没有内置脱敏；它的最近似做法是自己在
`formatter` 里为每个表手写同一套正则。Iris Table 把脱敏下沉到 core
（`maskValue`，框架无关），适配器只做薄桥，显示 / 导出 / 复制三路共享同一份
掩码规则。

## 列级配置

`IrisTableColumn.mask` 有两种形态：

- `'sensitive'` — 内置敏感规则（core `maskValue`）：邮箱 → 11 位手机号
  （3+4+4）→ 通用 ≥6 位（前 2 + `****` + 后 2）→ 更短整体 `'****'`；空值 → `''`
  （与 `toCsv` 空单元格一致）；
- 自定义函数 `(value: unknown) => string` — 接收**原始值**，返回掩码后的字符串。

`mask` 在显示链里**最先**生效：`render` / `html` / `link` / `formatter` /
tooltip 看到的都是掩码后的值（`formatter` 收到的是掩码后的**字符串**）；
行内编辑、校验、排序、过滤、汇总、区间统计与条件格式仍读**原始值**。

导出与复制**默认掩码**：`exportCsv` / `exportCurrentViewCsv` /
`exportSelectionCsv` 与 clipConfig 复制（TSV）按列应用掩码；某列设置
`exportRaw: true` 后导出/复制该列的原始值（显示仍掩码）。

## 示例

```tsx
import { IrisTable } from '@iris-ui-kit/react'
import type { IrisTableColumn } from '@iris-ui-kit/react'

interface Row {
  id: number
  name: string
  email: string
  phone: string
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  // 内置敏感规则：email → 手机号 → 通用
  { key: 'email', title: 'Email', mask: 'sensitive' },
  // 自定义规则：保留首尾，中间打码
  {
    key: 'phone',
    title: 'Phone',
    mask: (v) => `${String(v).slice(0, 3)}****${String(v).slice(-4)}`,
  },
  // 导出/复制时输出原始手机号（显示仍掩码）
  { key: 'phone2', title: 'Phone (raw export)', mask: 'sensitive', exportRaw: true },
]

const rows: Row[] = [
  {
    id: 1,
    name: 'Alice',
    email: 'alexandra@example.com',
    phone: '13812345678',
    phone2: '13812345678',
  },
]

export function ContactTable() {
  return <IrisTable columns={columns} data={rows} rowKey="id" />
}
```

编辑天然读原始值：所有编辑入口从 `getCellValue` 取数，掩码只作用于显示层，
因此不会出现"编辑框里是打码值"的坑。

## core 直接使用

`maskValue(value, 'sensitive')` 是纯函数：`null/undefined → ''`，非字符串先
`String()` 再掩码。需要把同一套规则复用到 Vue/Solid/Svelte 适配器以外的场景时，
可直接从 `@iris-ui-kit/core` 引入。
