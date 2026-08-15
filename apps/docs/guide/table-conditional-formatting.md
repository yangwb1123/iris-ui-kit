# Table conditional formatting

Iris UI 独有的能力 — vxe-grid 没有内置条件格式引擎；它的最近似做法是在
`cell-style` 回调里为每个表手写同一套谓词循环。Iris Table 把规则下沉到
core（`matchConditionalStyles`），四框架共享，适配器只做薄桥。

## 规则模型

`conditionalStyles` 接收一个**有序**规则数组，逐条应用到每个可见单元格：

- 规则可选 `column` 过滤（省略 → 所有列都应用）；
- `when(row, value)` 返回 true 时该规则命中 —— `value` 是单元格的**原始值**
  （`dataIndex ?? key` 已解析、公式列走 `getCellValue` 计算后的值），规则读到
  的与单元格渲染的完全一致；
- 命中的规则按数组顺序合并到单元格内联样式上，**后命中的规则在冲突键上获胜**
  （与 `cellStyle` 已有的覆盖纬度相同）。

求值顺序：`cellStyle` 先合并，`conditionalStyles` 随后覆盖。未命中任何规则时
单元格样式不变。求值成本 = 可见单元格 × 规则数（虚拟滚动天然限制可见单元格数；
规则数组请在调用方用 `useMemo` 保持稳定）。

## 示例

```tsx
import { useMemo } from 'react'
import { IrisTable } from '@iris-ui-kit/react'
import type { IrisTableColumn } from '@iris-ui-kit/react'

interface Row {
  id: number
  name: string
  status: string
  score: number
}

const columns: IrisTableColumn<Row>[] = [
  { key: 'name', title: 'Name' },
  { key: 'status', title: 'Status' },
  { key: 'score', title: 'Score' },
]

const rows: Row[] = [
  { id: 1, name: 'Charlie', status: 'active', score: 10 },
  { id: 2, name: 'Alice', status: 'paused', score: 25 },
  { id: 3, name: 'Bob', status: 'active', score: 40 },
]

export function Scoreboard() {
  // 规则数组保持稳定，避免每帧重新分配（虚拟滚动逐格求值）
  const conditionalStyles = useMemo(
    () => [
      // 全表规则：暂停状态整行警示色
      {
        column: 'status',
        when: (row: Row) => row.status === 'paused',
        style: { background: 'var(--iris-warning)' },
      },
      // 列规则：高分命中主色（后合并，冲突键覆盖上面的警示色）
      {
        column: 'score',
        when: (row: Row, value: unknown) => (value as number) >= 30,
        style: {
          background: 'var(--iris-primary)',
          color: 'var(--iris-primary-foreground)',
          fontWeight: 600,
        },
      },
    ],
    [],
  )
  return (
    <IrisTable columns={columns} data={rows} rowKey="id" conditionalStyles={conditionalStyles} />
  )
}
```

样式只用 `var(--iris-*)` token（与全库主题约定一致）；规则内联样式与 `cellStyle`
拥有相同的覆盖纬度，因此也可用于强调列钉住、对齐等结构性样式。

## core 直接使用

`matchConditionalStyles(rules, row, columnKey, value)` 是纯函数、无副作用：
不修改 `rules`/`row`/规则样式，无命中时返回 `{}`。需要把同一套规则复用到
Vue/Solid/Svelte 适配器以外的场景时，可直接从 `@iris-ui-kit/core` 引入。
