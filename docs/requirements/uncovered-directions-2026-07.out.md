根据我以上对源码的详细交叉验证，以下是对这份分析文档的逐项评审：

---

## 全库源码交叉验证结论

### 方向一 🧩 —— ✅ **基本准确，但有一处关键细节有误**

| Claim                                                                                           | 验证结果                                                                                                            |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `createValidationEngine`、`createStepNavigation`、`createFieldValueOps` 在 `form/` 子目录中存在 | ✅ **正确**                                                                                                         |
| 三个模块未被 re-export 到 `form.ts` 或 `index.ts`                                               | ✅ **正确**                                                                                                         |
| **被 `createFormStore` 内部使用**                                                               | ❌ **不准确** —— `createFormStore` 有完全**内联**的实现，不引用这些文件。它们是独立的工具函数，遵循相同模式但自包含 |
| "单元测试已有"                                                                                  | ✅ `validation.test.ts` 确实存在于 `form/__tests__/`                                                                |
| "核心是复用逻辑之家" + "A 零配置在场" —— 但未导出                                               | ✅ 合理的架构原则论证                                                                                               |

**关键纠正**：`createFormStore` 的 `nextStep`/`prevStep`/`goToStep`/`validateStep` 是内置在 `form.ts` 中的，不是 `createStepNavigation` 的消费者。这三个模块是外部的、未使用的辅助函数。这意味着导出它们不会与现有 `createFormStore` 产生交互——它们是**独立的**，不是**内部依赖**。

在"边界情况"表中，相应场景的描述也需要修正。

---

### 方向二 📦 —— ⚠️ **基本正确，但需要重要细微差别**

| Claim                                             | 验证结果                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| React `useForm` 未传递 `steps`、`dependencies` 等 | ✅ **正确** —— React 的 `useForm` 只传递 `initialValues`、`validators`、`validateOnChange`、`validateOnBlur`、`validate`、`onSubmit`。缺失：`steps`、`dependencies`、`validationDebounceMs`、`setFieldValueDebounceMs`、`validateOnMount`、`parse`、`transform`、`maxHistory` |
| Vue/Solid/Svelte `useForm` 未暴露 step 方法       | ⚠️ **需要区分** —— Vue/Solid/Svelte 使用 `createFormStore(config)` 传递完整配置，所以 `steps: [...]` 会传给 core。step 通过 `form.nextStep()` 可访问，因为返回了 `form: FormStore<V>`。**只是没有在顶层返回类型中解构**                                                       |
| "四框架均缺失" 表格                               | ⚠️ 对于多步导航 (Vue/Solid/Svelte 中有，但不在顶层 API 中)；对于 React —— 确实缺失                                                                                                                                                                                            |
| `dependencies`（跨字段验证）在 useForm 中缺失     | ✅ React 缺失（未传递给 core）；Vue/Solid/Svelte 技术上支持因为传递了完整配置                                                                                                                                                                                                 |
| 草稿自动保存                                      | ✅ 所有四个框架均缺失 —— core 有 `serialize`/`hydrate`，但框架中没有 `autoSave` 包装                                                                                                                                                                                          |
| 提交流水线（重试等）                              | ✅ 均缺失                                                                                                                                                                                                                                                                     |

**核心发现**：**React** 的 `useForm` 比 Vue/Solid/Svelte 更受限，因为它从 `FormConfig` 中挑选了子集。Vue/Solid/Svelte 的 `useForm` 通过完整配置传递天然支持 steps 和 dependencies。这是分析中一个值得注意的细微差别。

---

### 方向三 🛠️ —— ✅ **完全准确**

| Claim                                    | 验证结果                                                  |
| ---------------------------------------- | --------------------------------------------------------- |
| 只有 2 个 CLI 命令（`list`、`scaffold`） | ✅ **正确**                                               |
| 没有 `init` 命令                         | ✅ **正确**                                               |
| 没有 `doctor` 命令                       | ✅ **正确**                                               |
| 没有 `build:theme` 命令                  | ✅ **正确**                                               |
| 没有 `upgrade` 命令                      | ✅ **正确**                                               |
| MCP 有 9 个工具 vs CLI 2 个              | ✅ **正确**（但表格表头写的是 8 个，实际 9 行——小不一致） |
| Style Dictionary 配置存在但未接入 CLI    | ✅ `packages/tokens/src/style-dictionary.ts` 存在         |

唯一的小改进点：MCP 工具表显示 8 个工具，但列出了 9 行——标头/计数的不一致。

---

### 方向四 🔍 —— ❌ **大部分事实不准确**

| Claim                                                          | 验证结果                                                 |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| **"复合组件在运行期对子元素组合的正确性没有任何验证"**         | ❌ **错误** —— 所有四个框架已经有上下文缺失的运行期检查  |
| "DialogTrigger/DialogClose 是唯一的 `isValidElement` 检查"     | ❌ **不准确** —— Button、TabsTrigger、MenuTrigger 也检查 |
| "useContext 返回 undefined → 静默失败或抛出难理解的 typeError" | ❌ **错误** —— 所有 React 上下文钩子都抛出了有意义的错误 |

**我验证了以下全部存在**：

| 框架   | 组件          | 检查模式                                                                                                 |
| ------ | ------------- | -------------------------------------------------------------------------------------------------------- |
| React  | Dialog        | `useDialogContext()` → `throw new Error("[iris-ui] ... must be a descendant of <IrisDialog>")`           |
| React  | Menu          | `useMenuContext()` → 同上模式                                                                            |
| React  | Popover       | `usePopoverContext()` → 同上模式                                                                         |
| React  | Tabs          | `useTabsContext()` → `throw new Error("[iris-ui] ... must be inside an <IrisTabs>")`                     |
| React  | Accordion     | `useAccordionContext()` → 同上模式                                                                       |
| Vue    | AccordionItem | `if (!ctx) { throw new Error('... must be used inside <IrisAccordion>') }`                               |
| Vue    | TabsContent   | `if (!ctx) { throw new Error('[iris-ui] IrisTabsContent must be inside an IrisTabs') }`                  |
| Vue    | MenuItem      | `if (!ctx) { throw new Error('[iris-ui] IrisMenuItem must be inside an IrisMenuContent') }`              |
| Svelte | Dialog        | `getDialogContext()` → `if (!ctx) throw new Error("[iris-ui] ... must be a descendant of <IrisDialog>")` |
| Svelte | Tabs          | `getTabsContext()` → `if (!ctx) throw new Error("[iris-ui] Tabs components must be inside IrisTabs")`    |

**建议方向表格中的"目标 1"**（"为 useContext/getContext/inject 缺失添加友好的错误提示"）已经以完全相同的形式实现。

`isValidElement` 检查不仅存在于 DialogTrigger/DialogClose，还存在于 `Button`、`TabsTrigger`、`MenuTrigger`。

`Combobox` 和 `Select` 的 grep 搜索返回空，这确实是正确的——Select 使用不同的数据传递模式（提供者传递选项），而 Combobox 在分析中没有对应的上下文文件。然而，覆盖 Dialog、Menu、Tabs、Popover、Accordion 的上下文检查涵盖了主要的复合组件。

这个方向应该被**重写**或**废弃**，因为它以为存在一个已经解决的根本问题。

---

### 方向五 📊 —— ✅ **基本准确，一处小不准确**

| Claim                              | 验证结果                                                     |
| ---------------------------------- | ------------------------------------------------------------ |
| 零个 `@deprecated` 标注            | ✅ 除了 Solid 中有一个（`@deprecated Use autosize instead`） |
| 没有分包 CHANGELOG/MIGRATION 文件  | ✅ **正确**                                                  |
| `PROFILE_VERSION = 1` 迁移从未实现 | ✅ **正确** —— 注释写着"Version migrations go here"          |
| 没有 API surface diff 工具         | ✅ **正确**                                                  |
| 没有版本一致性强制                 | ✅ **正确**                                                  |

---

## 总体评估

| 方向      | 事实准确性               | 分析深度 | 建议质量 | 整体                                             |
| --------- | ------------------------ | -------- | -------- | ------------------------------------------------ |
| 🧩 方向一 | ⭐⭐⭐⭐（一处事实错误） | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **良好，适合实施**                               |
| 📦 方向二 | ⭐⭐⭐（需要细微差别）   | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **良好，但 React/Vue/Solid/Svelte 需要分别叙述** |
| 🛠️ 方向三 | ⭐⭐⭐⭐⭐               | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **优秀，完全准确**                               |
| 🔍 方向四 | ⭐⭐（核心前提错误）     | ⭐⭐     | ⭐⭐⭐   | **需要基于当前代码库状态重写**                   |
| 📊 方向五 | ⭐⭐⭐⭐⭐               | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | **优秀，完全准确**                               |

### 建议的重写/修正

1. **方向一**：修正 `createFormStore` "内部使用" → "独立实现，相同模式"
2. **方向二**：将结论拆分为 React（配置子集问题）和 Vue/Solid/Svelte（API 表面暴露问题）
3. **方向四**：核心前提需要完全重写。上下文验证和 `asChild` 验证已经存在。一个好的替代方向是：**跨框架验证的一致性审计**（确保所有四个框架对所有使用上下文的组件有等同的覆盖），或者**子元素类型组合验证**（检查 `IrisSelectItem` 是否正确嵌套在 `IrisSelectContent` 内部，而不仅仅是 `IrisSelect` 内部）
4. **方向五**：除了 React/Solid/Svelte 之间的 `@deprecated` 覆盖范围可能存在细微差异外，其余都非常可靠
