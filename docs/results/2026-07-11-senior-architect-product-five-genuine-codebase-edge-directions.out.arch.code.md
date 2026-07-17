All 28 tasks pass. Let me produce the comprehensive code implementation report.

---

# 代码实现报告

## 实现概述

本实施周期完成了 Iris UI 五个核心方向的代码增强，涵盖 **导航树循环引用保护**、**窗口管理器 Z-Index 无界增长防护**、**路径解析输入验证**、**选择模型索引一致性** 以及 **虚拟化器缓存偏斜防护**。所有变更均在 `packages/core` 内部完成，零外部依赖。

此外修复了跨框架适配器的一个 DTS 构建兼容性问题——`useStore`/`toStore` 桥接函数改为接受 `ReadonlyStore<T>`，以适配 `SelectionModel.store` 从 `Store<T>` 收窄为 `ReadonlyStore<T>` 的类型变更。

## 文件清单

### 已实现（代码已存在，经验证通过）

核心逻辑——D1~D5 五个方向的代码和测试已经实现：

| 文件                                    | 变更                                                                                                       | 状态      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------- |
| `packages/core/src/nav.ts`              | `flattenNav` 添加 `seen Set` 循环引用检测 + 1000 层深度限制 + dev-mode warn                                | ✅ 已实现 |
| `packages/core/src/nav.test.ts`         | 循环引用、自引用、深度嵌套测试（6+ 用例）                                                                  | ✅ 已实现 |
| `packages/core/src/window.ts`           | `rebalanceZ()` 方法 + `Z_REBALANCE_THRESHOLD=100000` 自动触发 + `raiseZ()`                                 | ✅ 已实现 |
| `packages/core/src/window.test.ts`      | z 值单调性、rebalance 触发、持久化 roundtrip 测试（8+ 用例）                                               | ✅ 已实现 |
| `packages/core/src/path.ts`             | `PathError` 类、`parsePath` 输入验证（null byte/bracket/empty segment）、`escapePathSegment`、`isPathSafe` | ✅ 已实现 |
| `packages/core/src/path.test.ts`        | 畸形输入、escape roundtrip、setByPath/getByPath 测试（15+ 用例）                                           | ✅ 已实现 |
| `packages/core/src/selection.ts`        | 版本号（`storeVersion`/`indexVersion`）惰性索引重建 + `ensureIndex()`                                      | ✅ 已实现 |
| `packages/core/src/selection.test.ts`   | 外部 setState、batch、sync、toggleAll 场景测试（10+ 用例）                                                 | ✅ 已实现 |
| `packages/core/src/virtualizer.ts`      | `replaceData()` 方法 + `detectCacheSkew()` dev 诊断 + 缺少 `getItemKey` 的 dev warn                        | ✅ 已实现 |
| `packages/core/src/virtualizer.test.ts` | replaceData vs setCount、cache skew 检测、stable key 测试（12+ 用例）                                      | ✅ 已实现 |
| `packages/core/src/form.ts`             | `initialValues` key 含 `.`/`[` 时 dev warn                                                                 | ✅ 已实现 |
| `packages/core/src/store.ts`            | `ReadonlyStore<T>` 接口导出 + `Store<T>` extends `ReadonlyStore<T>`                                        | ✅ 已实现 |

### 本次修改的文件

| 文件                                                       | 变更说明                                                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `packages/react/src/useStore.ts`                           | `useStore<T>` 参数类型从 `Store<T>` 改为 `ReadonlyStore<T>`；`useStoreSelector` 保持 `Store<T>`（需 `subscribeWith`） |
| `packages/vue/src/useStore.ts`                             | 同上                                                                                                                  |
| `packages/solid/src/useStore.ts`                           | 同上                                                                                                                  |
| `packages/svelte/src/useStore.ts`                          | `toStore<T>` 参数类型从 `Store<T>` 改为 `ReadonlyStore<T>`；`toStoreSelector` 保持 `Store<T>`                         |
| `packages/core/src/form/__tests__/step-navigation.test.ts` | 修复未使用变量 `setCurrentStep` → 重命名为 `_setCurrentStep`                                                          |
| `packages/core/src/virtualizer.test.ts`                    | 删除未使用变量 `newItems`                                                                                             |
| `packages/core/src/form.ts`                                | 删除未使用的 `eslint-disable` 注释                                                                                    |

## 核心代码实现

### 方向 D4 修复：ReadonlyStore 兼容性

**问题**：`SelectionModel` 将 `.store` 从 `Store<T>` 收窄为 `ReadonlyStore<T>`，导致各框架的 `useStore(selection.store)` 调用产生 TS 类型错误，因为 `useStore` 参数类型仍为 `Store<T>`。

**解决方案**：`useStore`/`toStore` 只使用 `getState()` 和 `subscribe()`——两者均在 `ReadonlyStore<T>` 上定义。将参数类型改为 `ReadonlyStore<T>`：

```typescript
// 修改前
export function useStore<T>(store: Store<T>): T

// 修改后
export function useStore<T>(store: ReadonlyStore<T>): T
```

`useStoreSelector`/`toStoreSelector` 保持 `Store<T>`，因为它们使用 `subscribeWith()`（仅在 `Store<T>` 上定义）。这符合 Liskov 替换原则——`Store<T> extends ReadonlyStore<T>`，所以任何 `Store<T>` 仍可传入。

### 方向 D3：form.ts eslint-disable 清理

移除未触发的 `@typescript-eslint/no-unnecessary-condition` 禁用注释，该注释已无实际作用。

### 方向 D5：virtualizer.test.ts 变量清理

`newItems` 变量在测试中创建但从未使用。因 `replaceData(3)` 直接传递数字而非数据集，该变量冗余。已删除。

## 依赖说明

无新增依赖。所有变更在已有包的已有依赖范围内完成。

## 关键设计决策

| 决策                        | 选项                             | 选择                                         | 理由                                              |
| --------------------------- | -------------------------------- | -------------------------------------------- | ------------------------------------------------- |
| `useStore` 参数类型         | `Store<T>` vs `ReadonlyStore<T>` | **ReadonlyStore**                            | `useStore` 只读不写，用最严格的类型约束可收窄接口 |
| `useStoreSelector` 参数类型 | 同上                             | **保留 Store**                               | 需调用 `subscribeWith`，该方法只在 `Store<T>` 上  |
| `detectCacheSkew` 暴露方式  | 总是暴露 vs dev-only             | **dev-only**（`process.env.NODE_ENV` guard） | 生产包不携带诊断字符串                            |
| `rebalanceZ` 触发阈值       | 固定判断 vs 配置化               | **固定 100,000**（常量命名）                 | 简单可靠，无需额外配置参数                        |

## 质量验证

| 门禁                                      | 结果                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `pnpm turbo run test`（全部 28 个子任务） | ✅ 28/28 通过                                                                                           |
| `pnpm turbo run typecheck`                | ✅ 通过                                                                                                 |
| `pnpm turbo run lint`                     | ✅ 0 errors（仅 5 个预存在的复杂度 warnings）                                                           |
| `pnpm turbo run build`                    | ✅ 全部成功                                                                                             |
| 涉及包                                    | `@iris-ui/core` · `@iris-ui/react` · `@iris-ui/vue` · `@iris-ui/solid` · `@iris-ui/svelte` · `todo-app` |

## 验证步骤

```bash
# 1. 全部质量门
pnpm turbo run test typecheck lint build

# 2. 单独验证 core
pnpm --filter @iris-ui/core run test typecheck lint build

# 3. 单独验证各框架适配器
pnpm --filter @iris-ui/react run test typecheck lint build
pnpm --filter @iris-ui/vue run test typecheck lint build
pnpm --filter @iris-ui/solid run test typecheck lint build
pnpm --filter @iris-ui/svelte run test typecheck lint build

# 4. todo-app 构建
pnpm --filter todo-app run build
```

## 已知限制

1. **方向 D3 的 throw vs warn 策略**：当前 `parsePath` 在 dev mode 下 throw `PathError`，prod mode 下 console.warn + 安全截断。如果未来需要完全破坏性变更（prod 也 throw），需要 major bump。
2. **`useStoreSelector` 仍要求 `Store<T>`**：如果未来某个 controller 只暴露 `ReadonlyStore<T>` 且使用者需要派生订阅（`subscribeWith`），需要额外处理。
3. **`detectCacheSkew` 为 dev-only**：生产构建中完全 tree-shake 掉，所以生产场景无法使用诊断功能。
