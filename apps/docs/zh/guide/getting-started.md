# 快速开始

Iris UI 在 **React 18/19**、**Vue 3.5**、**Solid 1.9** 和 **Svelte 5** 中提供同名组件——相同的名字，相同的语义，共享框架无关的核心。

## 安装

```bash
# React
pnpm add @iris-ui/react @iris-ui/theme @iris-ui/tokens

# Vue
pnpm add @iris-ui/vue @iris-ui/theme @iris-ui/tokens

# Solid
pnpm add @iris-ui/solid @iris-ui/theme @iris-ui/tokens

# Svelte
pnpm add @iris-ui/svelte @iris-ui/theme @iris-ui/tokens
```

## 1. 主题提供者

应用 CSS 变量、全局样式和书写方向。每个 Iris 组件读取 `var(--iris-*)` 令牌。

```tsx
import { ThemeProvider, IrisButton } from '@iris-ui/react'
import { createThemeStore } from '@iris-ui/theme'
import { lightTheme, darkTheme } from '@iris-ui/tokens'

const store = createThemeStore({
  themes: { light: lightTheme, dark: darkTheme },
  default: 'light',
})

export function App() {
  return (
    <ThemeProvider store={store}>
      <IrisButton variant="solid" onClick={() => alert('你好！')}>
        开始使用
      </IrisButton>
    </ThemeProvider>
  )
}
```

## 2. 数据表格 + 增删改查

约 30 行代码构建功能完整的数据列表——含排序、筛选、分页和乐观更新：

```tsx
import { useResourceController, createClientFetcher, IrisTable } from '@iris-ui/react'

const DATA = [
  { id: 1, name: 'Ada Lovelace', role: '工程师', status: 'active' },
  { id: 2, name: 'Alan Turing', role: '研究员', status: 'active' },
]

const COLUMNS = [
  { key: 'name', getValue: (r) => r.name },
  { key: 'role', getValue: (r) => r.role },
]

function UserTable() {
  const users = useResourceController({
    fetcher: createClientFetcher(DATA, COLUMNS),
    pageSize: 10,
    resilient: { ttlMs: 5000, breaker: { failureThreshold: 3, resetMs: 10000 } },
  })

  return <IrisTable columns={COLUMNS} data={users.state.rows} rowKey="id" sortable />
}
```

## 3. Schema 驱动表单

定义表单 Schema 即可生成可验证、无障碍的表单：

```tsx
import { IrisFormBuilder } from '@iris-ui/plugin-form-builder/react'

const schema = {
  submitLabel: '创建用户',
  fields: [
    { name: 'name', type: 'text', label: '姓名', required: true },
    { name: 'email', type: 'email', label: '邮箱', required: true },
    {
      name: 'role',
      type: 'select',
      label: '角色',
      required: true,
      options: [
        { label: '工程师', value: 'engineer' },
        { label: '设计师', value: 'designer' },
      ],
    },
  ],
}

function UserForm() {
  return <IrisFormBuilder schema={schema} onSubmit={(v) => console.log(v)} validateOnChange />
}
```

## 4. 插件系统

重型能力以插件按需安装：

```bash
pnpm add @iris-ui/plugin-editor @iris-ui/plugin-charts @iris-ui/plugin-locale-zh
```

通过 `IrisProvider` 激活：

```tsx
import { IrisProvider, IrisCodeEditor } from '@iris-ui/react'
import { editorPlugin } from '@iris-ui/plugin-editor/core'
import { zhPlugin } from '@iris-ui/plugin-locale-zh/core'

function App() {
  return (
    <IrisProvider plugins={[editorPlugin, zhPlugin]} locale="zh-CN">
      <IrisCodeEditor language="sql" value="SELECT * FROM users" />
    </IrisProvider>
  )
}
```

## 继续学习

- [主题系统](/zh/guide/theming) — 令牌、皮肤、暗黑模式、RTL
- [数据与韧性](/zh/guide/data-layer) — 缓存、熔断、离线队列、实时数据
- [插件开发](/zh/guide/plugins) — 创建自己的 Iris 插件
- [组件列表](/zh/components) — 149 个组件的完整 API 参考
