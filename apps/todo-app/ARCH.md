# Iris Todo App — Architecture Design

## 1. 概述

基于 Iris UI (`@iris-ui/react`) 的 **单页 Todo 应用**，演示 Iris UI 组件库在实际应用中的用法。

**目标**：

- 展示 Iris UI 组件的真实集成（Card、Button、Input、Checkbox、EmptyState、Toast、Skin Engine）
- 完整的 CRUD + 筛选 + 本地持久化
- 主题切换（light/dark/custom skins）
- 符合 Iris UI 项目的代码规范和质量门

## 2. 架构概览

### 2.1 组件树

```
App
└─ SkinProvider (engine: skinEngine)
   └─ IrisProvider (plugins: [])
      ├─ TodoAppShell
      │  ├─ Header (title + skin picker)
      │  ├─ IrisCard
      │  │  ├─ TodoHeader (IrisInput + IrisButton → add todo)
      │  │  ├─ TodoFilters (3× IrisButton → All/Active/Completed)
      │  │  ├─ TodoList (filtered list)
      │  │  │  └─ TodoItem × N (IrisCheckbox + edit + delete)
      │  │  └─ TodoFooter (active count + clear completed)
      │  └─ Footer (attribution)
      └─ IrisToastViewport (global toast queue)
```

### 2.2 分层架构

遵循 Iris UI 的 L0–L4 分层：

| 层        | 内容                                            |
| --------- | ----------------------------------------------- |
| L0 逻辑   | `useTodos` hook, `filters.ts`, `storage.ts`     |
| L1 元原语 | IrisButton, IrisInput, IrisCheckbox, IrisCard   |
| L2 组合   | IrisEmptyState, IrisToastViewport               |
| L3 布局   | 内联 flexbox 布局（无 Iris 布局组件）           |
| L4 系统   | SkinProvider, IrisProvider（提供主题/插件骨架） |

## 3. 数据流

```
                    ┌─────────────┐
                    │ localStorage │
                    └──────┬──────┘
                           │ load/save
                    ┌──────▼──────┐
                    │ useTodos()  │ ← state owner
                    │  - todos[]  │
                    │  - filter   │
                    └──────┬──────┘
                           │ CRUD callbacks
         ┌───────────────┬─┼─┬───────────────┐
         ▼               ▼ ▼ ▼               ▼
   TodoHeader       TodoList     TodoFooter  TodoFilters
         │               │
         │          ┌────▼─────┐
         │          │ filter() │ (pure fn)
         │          └────┬─────┘
         ▼               ▼
   addTodo()       filteredTodos[]
```

### 3.1 CRUD 操作（`useTodos`）

| 操作         | 方法                   | 副作用                                 |
| ------------ | ---------------------- | -------------------------------------- |
| 创建         | `addTodo(text)`        | 插入到数组顶部                         |
| 读取（筛选） | `filteredTodos`        | `filterTodos()`                        |
| 更新         | `updateTodo(id, text)` | 替换 text                              |
| 删除         | `deleteTodo(id)`       | 从数组移除                             |
| 切换完成状态 | `toggleTodo(id)`       | 翻转 completed                         |
| 清空已完成   | `clearCompleted()`     | 移除所有 completed                     |
| 筛选切换     | `setFilter(f)`         | 更新 filter 状态                       |
| 持久化       | `storage.save()`       | 每次 todos 变更后自动写入 localStorage |

### 3.2 数据模型

```typescript
interface Todo {
  id: string // "todo-{timestamp}-{counter}"
  text: string // 用户输入的任务描述
  completed: boolean
  createdAt: number // Date.now()
}

type TodoFilter = 'all' | 'active' | 'completed'
```

## 4. 主题与皮肤

使用 Iris UI 的 `createSkinEngine` 构建皮肤引擎，支持 4 种皮肤：

| 皮肤 ID   | 名称          | 基主题 | 特点          |
| --------- | ------------- | ------ | ------------- |
| `light`   | Light（默认） | light  | Iris 默认亮色 |
| `dark`    | Dark          | dark   | Iris 默认暗色 |
| `forest`  | Forest        | dark   | 深绿森林风    |
| `sunset`  | Sunset        | light  | 暖红日落风    |
| `sunrise` | Sunrise       | light  | 橙色日出风    |
| `auto`    | Auto (system) | light  | 跟随系统偏好  |

皮肤选择持久化在 localStorage key `iris-todo-app-skin`。

## 5. 文件结构

```
apps/todo-app/
├── index.html              # HTML entry
├── package.json            # 依赖声明
├── tsconfig.json           # TS 配置（继承 monorepo base）
├── vite.config.ts          # Vite 配置（dev source alias）
├── public/
│   └── favicon.svg         # 图标（checkbox SVG）
└── src/
    ├── main.tsx            # React DOM 入口
    ├── App.tsx             # 根组件（providers + shell）
    ├── style.css           # 全局样式（只使用 var(--iris-*) tokens）
    ├── types/
    │   └── todo.ts         # Todo / TodoFilter 类型
    ├── utils/
    │   ├── storage.ts      # localStorage 读写（SSR-safe fallback）
    │   └── filters.ts      # 纯函数：filterTodos / activeCount / hasCompleted
    ├── hooks/
    │   └── useTodos.ts     # 核心状态管理 hook
    └── components/
        ├── TodoHeader.tsx  # 添加 todo 的表单
        ├── TodoFilters.tsx # All / Active / Completed 筛选
        ├── TodoList.tsx    # 列表渲染 + IrisEmptyState
        ├── TodoItem.tsx    # 单行（checkbox + 编辑 + 删除）
        └── TodoFooter.tsx  # 计数 + 清空已完成
```

## 6. 遵循的 Iris UI 原则

1. **原语优先** — TodoItem 组合 IrisCheckbox + IrisButton，没有自造轮子。
2. **Token 杠杆** — 所有颜色/间距/圆角通过 `var(--iris-*)`，主题切换全自动。
3. **A/B/C 下沉** — 纯逻辑 `filters.ts` (C) 无 React 依赖，`storage.ts` (B) 可替换，`useTodos` (A) 是唯一状态源。
4. **框架无侵入** — `filters.ts` 和 `storage.ts` 可直接移植到 Vue/Solid/Svelte。
5. **SSR 安全** — `useTodos` 使用 `useEffect` 做持久化，首次渲染不读 localStorage。
6. **渐进式复杂度** — 从简单的 `/src/App.tsx` 起步，可逐步接入插件系统。

## 7. 未来扩展（非当前范围）

- 接入 `plugin-locale-zh` 实现中文 i18n
- 使用 `IrisSidebarLayout` / `IrisHeaderLayout` 实现复杂布局
- 使用 `createResourceController` 实现后端同步
- 添加拖拽排序（`useDraggable`）
- Tags / 分类 / 优先级（`IrisSelect` + `IrisChip`）
- Undo/redo（`@iris-ui/react/undo`）
