# Iris Todo App — Implementation Plan

## 阶段 1：项目骨架（已完成）

### 1.1 创建目录结构

```
apps/todo-app/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── style.css
    ├── types/
    ├── utils/
    ├── hooks/
    └── components/
```

### 1.2 配置项目

- **package.json**: 依赖 `@iris-ui/react`, `react`, `react-dom`, 开发依赖 Vite React 插件
- **tsconfig.json**: 继承 `../../tsconfig.base.json`, 启用 `react-jsx`
- **vite.config.ts**: dev 模式 source alias 到 packages 源码，实现 hot-reload
- **index.html**: 标准 Vite HTML 模板

### 1.3 验收标准

- [x] `pnpm --filter todo-app build` 成功
- [x] TypeScript 编译无错误

## 阶段 2：类型与工具函数（已完成）

### 2.1 类型定义 (`src/types/todo.ts`)

- `TodoFilter`: `'all' | 'active' | 'completed'`
- `Todo`: `{ id, text, completed, createdAt }`

### 2.2 持久化工具 (`src/utils/storage.ts`)

- `createTodoStorage()` → `{ load, save }`
- `load`: 从 `localStorage` 读取，SSR/隐私模式返回 `null`
- `save`: 写入 `localStorage`，静默处理写入失败

### 2.3 筛选工具 (`src/utils/filters.ts`)

纯函数、零框架依赖：

- `filterTodos(todos, filter)` → 按模式筛选
- `activeCount(todos)` → 未完成计数
- `hasCompleted(todos)` → 是否有已完成项

### 2.4 验收标准

- [x] 类型无 `any` 隐式
- [x] 纯函数可单元测试
- [x] storage 降级安全

## 阶段 3：核心状态管理（已完成）

### 3.1 `useTodos` Hook (`src/hooks/useTodos.ts`)

**职责**：

- 维护 `todos: Todo[]` 和 `filter: TodoFilter` 状态
- 初始化从 localStorage 读取
- 每次 todos 变化自动持久化
- 导出 CRUD 回调（稳定的 `useCallback` 引用）

**API**：

```typescript
const {
  todos, // 完整列表
  filter, // 当前筛选
  setFilter, // 设置筛选
  filteredTodos, // 筛选后的视图
  activeCount, // 未完成数
  addTodo, // (text) => void
  toggleTodo, // (id) => void
  updateTodo, // (id, text) => void
  deleteTodo, // (id) => void
  clearCompleted, // () => void
} = useTodos()
```

**设计决策**：

- 首次渲染跳过持久化（避免 hydration 不一致）
- id 使用 `timestamp-counter` 格式，适合单用户 Demo
- `addTodo` 空文本无操作
- `updateTodo` 空文本无操作

### 3.2 验收标准

- [x] 无 useEffect 无限循环
- [x] CRUD 操作幂等
- [x] 空/边界输入正确处理

## 阶段 4：UI 组件（已完成）

### 4.1 TodoHeader (`src/components/TodoHeader.tsx`)

- IrisInput + IrisButton 组合
- Enter 键提交、按钮点击提交
- 输入为空时按钮 disabled
- 提交后清空输入框

### 4.2 TodoFilters (`src/components/TodoFilters.tsx`)

- 三个 IrisButton: All / Active / Completed
- 选中项使用 `solid` variant，其他使用 `ghost`
- `aria-pressed` 无障碍属性

### 4.3 TodoItem (`src/components/TodoItem.tsx`)

- IrisCheckbox 切换完成状态
- 双击文本进入内联编辑模式
- Enter 确认、Escape 取消、blur 确认
- 删除按钮 hover 显示（CSS 控制）
- 完成项显示删除线 + muted 色

### 4.4 TodoList (`src/components/TodoList.tsx`)

- 空状态时显示 IrisEmptyState
- 不同筛选模式的空状态文案不同
- role="list" / role="listitem" 无障碍

### 4.5 TodoFooter (`src/components/TodoFooter.tsx`)

- 显示 `"{n} items left"`
- 有 completed 项时显示 "Clear completed" 按钮

### 4.6 验收标准

- [x] 所有组件使用 `var(--iris-*)` 而非硬编码颜色
- [x] 键盘可操作
- [x] aria 属性完整

## 阶段 5：App 整合（已完成）

### 5.1 App.tsx

- **SkinProvider** + `createSkinEngine` 提供主题能力
- **IrisProvider** 提供插件系统骨架
- 4 种自定义皮肤：Forest / Sunset / Sunrise / Auto
- 皮肤选择器（`<select>`）持久化到 localStorage
- IrisCard 容器包装所有 todo 组件
- IrisToastViewport 全局定位

### 5.2 主入口 (`src/main.tsx`)

- StrictMode
- `createRoot` 标准渲染

### 5.3 全局样式 (`src/style.css`)

- 只使用 `var(--iris-*)` tokens
- CSS 逻辑属性（RTL 就绪）
- prefers-reduced-motion 支持
- 自定义滚动条
- `::selection` 主题色

### 5.4 验收标准

- [x] `pnpm --filter todo-app build` 通过
- [x] TypeScript 编译无 error
- [x] 所有组件可见（可通过 `pnpm --filter todo-app dev` 验证）

## 阶段 6：质量验证（已完成）

### 6.1 检查清单

- [x] 代码编译通过（`tsc --noEmit && vite build` 通过）
- [x] noUnusedLocals / noUnusedParameters 通过（继承 `tsconfig.base.json` strict 配置）
- [x] 错误处理完整（空输入在 `addTodo`/`updateTodo` 中跳过；存储不可用时 `writeStorage` 静默降级）
- [x] 边界条件处理（空列表显示 IrisEmptyState 上下文文案；全完成/全未完成时筛选正确）
- [x] 安全检查（React 默认 textContent 渲染；无 `dangerouslySetInnerHTML` 或 innerHTML 注入）
- [x] 性能（CRUD 回调使用 `useCallback` 稳定引用；`filteredTodos`/`activeCount` 派生自 state 而非额外 state）
- [x] 文档已更新（ARCH.md 描述架构设计；IMPL_PLAN.md 标记完成状态）
- [x] 代码风格一致（Prettier 格式化通过）

### 6.2 手动验证步骤

1. `cd /home/u1/iris-ui && pnpm --filter todo-app run dev`
2. 添加几个 todo
3. 标记为完成/未完成
4. 筛选 All / Active / Completed
5. 双击编辑文本
6. 删除单个 todo
7. 清空已完成
8. 切换主题：Light / Dark / Forest / Sunset / Sunrise / Auto
9. 刷新页面验证持久化

### 6.3 自动化验证结果

```
$ pnpm --filter todo-app typecheck   # 通过（无错误）
$ pnpm --filter todo-app lint        # 通过（无警告）
$ pnpm --filter todo-app build       # 通过（tsc + vite build）
$ pnpm prettier --check "apps/todo-app/**/*"  # 通过（格式一致）
```
