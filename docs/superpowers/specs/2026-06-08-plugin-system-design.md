# Iris UI 插件系统 — 设计 Spec

> 日期：2026-06-08 · 状态：已批准，进入实现
> 目标：把 Iris UI 的核心保持精简，所有重型扩展（代码编辑器、ProTable 等）以**插件**形式按需 `use`，在 React/Vue/Solid/Svelte 四框架语义一致。

## 0. 背景与定位

Iris UI 已是五层架构 + 四框架适配器（react/vue/solid/svelte），逻辑沉淀在 `@iris-ui-kit/core`，框架层做薄桥。现有的子路径导出（`@iris-ui-kit/react/form` 等）已是一种隐形插件机制，但缺统一的 `install` 契约、配置入口与跨插件共享的注册表。本 spec 正式化这套契约。

**核心原则**：插件是**加法**，不是 monkey-patch。插件只能注册新东西（token / 翻译 / store / 新组件由用户静态 import），不能改写已有 core 组件或 schema。

## 1. 已定的架构决策

| 决策         | 选择                                                                                    | 理由                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 插件包形态   | **单包多子路径**：`@iris-ui-kit/plugin-x/{core,react,vue,solid,svelte}`                 | 与现有 `@iris-ui-kit/react` 子路径风格一致；一个包、按需导入框架层；社区主流（radix/shadcn）                          |
| `use()` 位置 | **统一 `IrisProvider`，接收 `plugins[]`**                                               | 单一入口；现有三 Provider 作为内部实现被包裹；向后兼容                                                                |
| 注册表 scope | **`registerTokens` + `registerMessages` + `registerStore`**（不含 `registerComponent`） | 这三者是真正跨插件的副作用，需共享 sink；动态组件名会牺牲类型/tree-shaking/manifest 三项立身之本，组件保持静态 import |

**不做**：`registerComponent`（全局动态组件名）。将来 CMS 内容类型若需 schema 驱动渲染，用局部、有类型的 `widgets` map prop 解决，不引入全局可变注册表。

**不改造**：现有 `form`/`behaviors`/`async`/`i18n`/`motion` 子路径模块——它们工作良好且不需要注册表，继续以子路径形式存在。

## 2. 核心契约（`@iris-ui-kit/core`，框架无关）

文件：`packages/core/src/plugin.ts`

```ts
export interface PluginRegistry {
  /** 注册 CSS 变量（如 `--iris-editor-bg`）。后注册覆盖前者并 dev 期 warn。 */
  registerTokens(tokens: Record<string, string>): void
  /** 注册某 locale 的翻译。与同 locale 已有 messages 合并。 */
  registerMessages(locale: string, messages: Record<string, string>): void
  /** 注册一个 store 工厂；key 唯一，供 `usePluginStore(key)` 消费。 */
  registerStore(key: string, factory: () => unknown): void
}

export interface IrisPlugin {
  readonly name: string
  install(registry: PluginRegistry): void
}

/** 身份函数 + dev 期校验（name 非空、build 期不重名）。 */
export function createPlugin(def: IrisPlugin): IrisPlugin

export interface CollectedRegistrations {
  tokens: Record<string, string>
  messages: Record<string, Record<string, string>> // locale → messages
  stores: Map<string, unknown> // key → store 实例（工厂已调用）
}

/** 纯、同步、确定性：执行所有 install，收集结果。系统唯一的"逻辑"，独立单测。 */
export function runPlugins(plugins: readonly IrisPlugin[]): CollectedRegistrations
```

**冲突策略**：tokens / messages / store-key 重复 → 后注册覆盖前者 + `console.warn`（dev，经现有 dev-warn 机制；prod 静默）。`runPlugins` 内 store 工厂**立即**调用一次（eager），保证 SSR 服务端/客户端确定性一致。

**i18n 小改动**：`packages/core/src/i18n.ts` 增 `mergeMessages(locale, messages)`（现有 `setMessages` 是替换语义，插件需要合并语义）。

## 3. `IrisProvider`（每框架一层薄桥，~50 行）

四框架同构（React `useMemo` / Vue `setup`+`provide` / Solid `createMemo`+`createContext` / Svelte `$derived`+`setContext`）。职责：

1. `const collected = runPlugins(plugins)`（memo 化，依赖 `plugins`）
2. **tokens** → 经 `@iris-ui-kit/theme` 的应用机制注入到 target（与用户主题并存的附加层，卸载 revert，复用现有 `injectGlobalStyles`/`applyTheme` SSR 安全路径）
3. **messages** → `i18n.mergeMessages(locale, msgs)`（插件作底、用户 messages 优先）
4. **stores** → 放进 `PluginContext`
5. 内部渲染：`ThemeProvider → SkinProvider → I18nProvider → PluginContext.Provider → children`

Props：

```ts
interface IrisProviderProps {
  theme?: ThemeStore            // 不传则内部 createThemeStore(defaultTheme)
  dir?: 'ltr' | 'rtl'
  locale?: string
  messages?: Record<string, string>
  plugins?: IrisPlugin[]
  children: ...
}
```

**向后兼容**：现有 `ThemeProvider`/`SkinProvider`/`I18nProvider` 保持导出可用；`IrisProvider` 只是组合 + 加插件层。不用插件的用户零改动。

## 4. 消费 API

```ts
usePlugin(name: string): boolean      // 插件是否已安装
usePluginStore<T>(key: string): T     // 读注册的 store；缺失 throw 明确错误
```

四框架各实现一份（命名一致；Vue 是 `usePlugin`/`usePluginStore` 组合式函数，Svelte 是 `getContext` 包装）。插件导出类型化包装收窄 `unknown`：

```ts
// @iris-ui-kit/plugin-editor/react
export const useEditorStore = () => usePluginStore<EditorStore>('editor')
```

## 5. 插件包结构（方案 A）

```
@iris-ui-kit/plugin-<name>/
  package.json        # exports: ./core ./react ./vue ./solid ./svelte ; 多入口 tsup/svelte-package 构建
  src/core/index.ts   # createPlugin({ name, install }) + 框架无关 store 工厂/逻辑
  src/react/index.tsx
  src/vue/index.ts
  src/solid/index.tsx
  src/svelte/index.ts # 经 svelte-package
```

用法（install 逻辑框架无关，UI 框架专属）：

```tsx
import { editorPlugin } from '@iris-ui-kit/plugin-editor/core'
import { IrisCodeEditor } from '@iris-ui-kit/plugin-editor/react'
;<IrisProvider plugins={[editorPlugin]}>
  <IrisCodeEditor language="sql" />
</IrisProvider>
```

## 6. 首批插件

### 6.1 `@iris-ui-kit/plugin-locale-zh`（最小参考）

- 仅 `registerMessages('zh-CN', {...})`，无 UI。验证 messages 链路端到端。框架无关单包（只有 `/core`）。

### 6.2 `@iris-ui-kit/plugin-editor`（dbgate 式代码编辑器）

- 依赖 **CodeMirror 6**（`@codemirror/state`/`view`/`commands` + 按需 `@codemirror/lang-sql`/`lang-json`/`lang-javascript`）。CM6 而非 Monaco：模块化、体积可控、Vite 友好。
- `core`：`createEditorState(config)` 封装 CM6 `EditorState`/`EditorView`，受控 `value`/`onChange` 接口；`registerTokens` 注入 `--iris-editor-*`；`registerStore('editor', ...)`。CM6 主题桥接到 `@iris-ui-kit/tokens`。
- 四框架 `IrisCodeEditor`：挂载容器 + 命令式 view 生命周期（mount/update/destroy），声明式受控。`language` prop 按需加载语言包。
- 边界：本期支持 SQL / JSON / JavaScript 三语言；diff 视图、自动补全列入后续。

### 6.3 `@iris-ui-kit/plugin-pro-table`（vxe-table 式 CRUD 表格，Phase 1 充分集）

- `core`：`createProTableStore(config)`（扩展现有 table 逻辑）——列状态、排序、筛选、行选择（单/多/全选）、内联编辑态、分页集成、服务端模式 `onLoad(params)=>Promise<{rows,total}>`；复用 core 的 `createPaginatedResource` + `computeVirtualRange` + `toSpreadsheetXml`（CSV/Excel 导出）。
- 四框架 `IrisProTable`：渲染层；`columns` 配置；`renderCell` 为框架原生 render（JSX / `h` / Solid JSX / Svelte snippet，**不用 innerHTML**）；固定列 `position:sticky`；行虚拟化复用 `IrisVirtualScroll`；分页复用 `IrisPagination`。
- Phase 1 范围：排序/筛选/列隐藏/行选择/内联编辑/固定列/分页/导出/服务端模式 + 行虚拟化。Phase 2（列宽拖拽、列拖拽排序、树形行、多级表头、聚合行、列虚拟化）后续迭代。

## 7. 测试与质量门

- **core**：`runPlugins` 单测（冲突策略、顺序、空集、store eager 调用）+ `mergeMessages`。
- **四框架 Provider**：每框架一个 example 插件 fixture（注册 tokens+messages+store+trivial UI），断言注入正确、`usePluginStore` 可读、卸载 revert。
- **plugin-locale-zh**：messages 链路端到端。
- **plugin-editor / plugin-pro-table**：各组件 render + 核心行为测试。
- 全部纳入现有 `turbo run test typecheck lint build` + `pnpm size`（新增插件包 size 预算）+ `check:manifest`（manifest discover 扩展到插件包）。

## 8. 构建顺序（实现阶段）

1. **地基**：core 契约（`plugin.ts` + `mergeMessages`）→ 四框架 `IrisProvider` + 消费 hook → `plugin-locale-zh` + example fixtures。门全绿，提交。
2. **editor**：`@iris-ui-kit/plugin-editor`（CM6 + 四框架）。门全绿，提交。
3. **pro-table**：`@iris-ui-kit/plugin-pro-table`（core store + 四框架）。门全绿，提交。

editor 与 pro-table 互不依赖，可并行；二者都依赖地基。
