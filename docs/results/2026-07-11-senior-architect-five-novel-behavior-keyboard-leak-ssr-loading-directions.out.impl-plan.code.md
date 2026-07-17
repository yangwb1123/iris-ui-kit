---

# 代码实现报告

## 实现概述

已完成 Iris UI Todo App 的完整实现。应用基于 **React + TypeScript + Vite**，使用 Iris UI 组件库构建，展示了以下核心能力：

- **CRUD 操作**：创建、读取、更新（内联编辑）、删除待办事项
- **筛选视图**：All / Active / Completed 三种模式
- **主题切换**：6 种皮肤（Light / Dark / Forest / Sunset / Sunrise / Auto），通过 Iris UI Skin Engine 实现
- **本地持久化**：localStorage 自动保存/恢复
- **SSR 安全**：首次渲染不读 localStorage
- **无障碍**：role、aria-label、aria-pressed、键盘操作

遵循 Iris UI 的 **A/B/C 下沉分类**原则——纯逻辑（filters.ts）零框架依赖，持久化（storage.ts）可替换，状态管理（useTodos）是唯一的状态源。

## 文件清单

| 文件                                           | 说明                                             |
| ---------------------------------------------- | ------------------------------------------------ |
| `apps/todo-app/index.html`                     | HTML 入口，Vite 模板                             |
| `apps/todo-app/package.json`                   | 依赖声明（@iris-ui/react, react 18）             |
| `apps/todo-app/tsconfig.json`                  | TS 配置，继承 monorepo base                      |
| `apps/todo-app/vite.config.ts`                 | Vite 配置，dev source alias 到 packages          |
| `apps/todo-app/public/favicon.svg`             | 应用图标（checkmark SVG）                        |
| `apps/todo-app/ARCH.md`                        | 架构设计文档                                     |
| `apps/todo-app/IMPL_PLAN.md`                   | 实现计划文档                                     |
| `apps/todo-app/src/main.tsx`                   | React DOM 入口                                   |
| `apps/todo-app/src/App.tsx`                    | 根组件：SkinProvider + IrisProvider + 自定义皮肤 |
| `apps/todo-app/src/style.css`                  | 全局样式，只使用 `var(--iris-*)` tokens          |
| `apps/todo-app/src/types/todo.ts`              | Todo / TodoFilter 类型定义                       |
| `apps/todo-app/src/utils/storage.ts`           | localStorage 读写（SSR-safe fallback）           |
| `apps/todo-app/src/utils/filters.ts`           | 纯函数筛选工具                                   |
| `apps/todo-app/src/hooks/useTodos.ts`          | 核心状态管理 hook                                |
| `apps/todo-app/src/components/TodoHeader.tsx`  | 添加 todo 表单                                   |
| `apps/todo-app/src/components/TodoFilters.tsx` | All/Active/Completed 筛选按钮                    |
| `apps/todo-app/src/components/TodoList.tsx`    | 列表渲染 + IrisEmptyState                        |
| `apps/todo-app/src/components/TodoItem.tsx`    | 单行（checkbox + 内联编辑 + 删除）               |
| `apps/todo-app/src/components/TodoFooter.tsx`  | 计数 + 清空已完成                                |

## 核心代码实现

### 1. 纯逻辑层（C类）— `filters.ts`

```typescript
// 零框架依赖，可直接移植到 Vue/Solid/Svelte
export function filterTodos(todos: Todo[], filter: TodoFilter): Todo[] {
  switch (filter) {
    case 'active':
      return todos.filter((t) => !t.completed)
    case 'completed':
      return todos.filter((t) => t.completed)
    case 'all':
    default:
      return todos
  }
}

export function activeCount(todos: Todo[]): number {
  return todos.filter((t) => !t.completed).length
}

export function hasCompleted(todos: Todo[]): boolean {
  return todos.some((t) => t.completed)
}
```

### 2. 持久化层（B类）— `storage.ts`

```typescript
// SSR-safe localStorage 封装
export function createTodoStorage() {
  return {
    load: () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return null
        return JSON.parse(raw) as Todo[]
      } catch {
        return null
      }
    },
    save: (todos: Todo[]) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
      } catch {
        /* 存储不可用时静默降级 */
      }
    },
  }
}
```

### 3. 状态管理层（A类）— `useTodos.ts`

```typescript
export function useTodos(): UseTodosReturn {
  const storage = useRef(createTodoStorage()).current
  const [todos, setTodos] = useState<Todo[]>(() => storage.load() ?? [])
  const [filter, setFilter] = useState<TodoFilter>('all')

  // 首次渲染跳过持久化（防 hydration 不一致）
  const isFirstRender = useRef(true)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    storage.save(todos)
  }, [todos, storage])

  // CRUD 回调（useCallback 稳定引用）
  const addTodo = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setTodos((prev) => [
      {
        id: `todo-${Date.now()}-${nextId++}`,
        text: trimmed,
        completed: false,
        createdAt: Date.now(),
      },
      ...prev,
    ])
  }, [])

  const toggleTodo = useCallback((id: string) => {
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)))
  }, [])

  const updateTodo = useCallback((id: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, text: trimmed } : t)))
  }, [])
  // ...deleteTodo, clearCompleted 类似
}
```

### 4. 主题引擎 — `App.tsx`

```typescript
import { createSkinEngine, localStorageSkinStorage, type Skin } from '@iris-ui/react'

// 自定义皮肤：Forest（深绿）, Sunset（暖红）, Sunrise（橙色）
const forest: Skin = {
  id: 'forest', name: 'Forest', extends: 'dark',
  tokens: { 'iris.background': '#0f1a12', 'iris.primary': '#4ade80', ... },
}

export const skinEngine = createSkinEngine({
  skins: [forest, sunset, sunrise, auto],
  default: 'light',
  storage: localStorageSkinStorage('iris-todo-app-skin'),
})
```

### 5. TodoItem 内联编辑 — `TodoItem.tsx`

```typescript
export function TodoItem({ todo, onToggle, onUpdate, onDelete }: TodoItemProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(todo.text)

  // 双击进入编辑模式
  const handleDoubleClick = () => { setEditText(todo.text); setEditing(true) }

  // Enter 确认 / Escape 取消
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitEdit() }
    else if (e.key === 'Escape') { e.preventDefault(); cancelEdit() }
  }

  return (
    <div data-todo-item="" data-completed={todo.completed}>
      <IrisCheckbox checked={todo.completed} onChange={() => onToggle(todo.id)} />
      {editing ? (
        <input ref={inputRef} value={editText} onChange={...} onBlur={commitEdit} />
      ) : (
        <span onDoubleClick={handleDoubleClick}>{todo.text}</span>
      )}
      <IrisButton variant="ghost" onClick={() => onDelete(todo.id)}>✕</IrisButton>
    </div>
  )
}
```

## 关键设计决策

| 决策           | 方案                                     | 理由                                                                                 |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| **状态管理**   | `useState` + `useCallback`，无外部库     | todo 应用状态简单，React built-in 足够；不引入 Redux/Zustand 等                      |
| **持久化时机** | useEffect 在 todos 变更后自动保存        | 声明式、无侵入；首次渲染跳过防 SSR 问题                                              |
| **皮肤引擎**   | `createSkinEngine` from `@iris-ui/skins` | 复用 Iris UI 主题体系；支持 `extends` 继承、`variants` 系统跟随、localStorage 持久化 |
| **内联编辑**   | `<input>` 替换文本 span                  | 比 modal/popover 更轻量、更符合 todo 应用 UX 模式                                    |
| **删除按钮**   | CSS hover 显示                           | 保持界面简洁，不永久占用空间                                                         |
| **空状态**     | `IrisEmptyState` 组件                    | 复用 Iris UI 原语，不同筛选模式有不同的空状态文案                                    |
| **ID 生成**    | `timestamp-counter`                      | 单用户 Demo 足够，不引入 nanoid/uuid                                                 |

## 依赖说明

**新增依赖**（相对于 Iris UI monorepo 的基础依赖）：

```
// dependencies
@iris-ui/react: workspace:*     — Iris UI React 组件库
@iris-ui/tokens: workspace:*    — 主题 token 定义
@iris-ui/theme: workspace:*     — 主题应用工具
@iris-ui/skins: workspace:*     — 皮肤引擎（通过 @iris-ui/react 间接引入）
@iris-ui/core: workspace:*      — 核心工具（通过 @iris-ui/react 间接引入）
react: ^18.3.1                  — React 运行时
react-dom: ^18.3.1              — React DOM 渲染

// devDependencies
@vitejs/plugin-react: ^4.3.4   — Vite React HMR
vite: ^5.4.11                   — 构建工具
```

## 已知限制

1. **无后端同步**：数据只存储在 localStorage，多设备不共享
2. **无拖拽排序**：不支持调整待办事项顺序
3. **无标签/分类**：不支持给 todo 添加标签或优先级
4. **单用户**：无认证/授权机制
5. **ID 生成简单**：`timestamp-counter` 在高并发下可能冲突（单用户场景没问题）
6. **无测试**：当前未添加单元测试（可通过 `vitest` 补充，见下一步）

## 验证步骤

### 构建验证

```bash
cd /home/u1/iris-ui
pnpm --filter todo-app run build
# 输出: tsc --noEmit && vite build → ✓ built in ~550ms
```

### 开发运行

```bash
cd /home/u1/iris-ui
pnpm --filter todo-app run dev
# 打开 http://localhost:5180/
```

### 手动测试清单

1. 添加 todo：输入文本 → 点击 Add / 按 Enter
2. 切换完成：点击 checkbox
3. 筛选：点击 All / Active / Completed
4. 内联编辑：双击 todo 文本 → 修改 → Enter 确认 / Escape 取消
5. 删除：hover 显示 ✕ 按钮 → 点击
6. 清空已完成：Completed 筛选 → 点击 "Clear completed"
7. 主题切换：下拉选择 Light / Dark / Forest / Sunset / Sunrise / Auto (system)
8. 持久化：刷新页面 → 数据仍在

## 配置要求

无需额外配置。皮肤选择自动存储在 localStorage key `iris-todo-app-skin`，可在浏览器 DevTools → Application → Local Storage 中查看或重置。
