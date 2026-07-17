---

# 代码实现报告

## 实现概述

根据 `docs/results/uncovered-directions-2026-07.out.plan.md` 中的任务分解，完成了 **方向一（导出未公开的表单模块）** 的所有 3 个任务：

- **TASK-001**：将 `createValidationEngine`、`createStepNavigation`、`createFieldValueOps` 及其相关类型从 `@iris-ui/core` barrel 重新导出
- **TASK-002**：为三个模块添加集成测试（异步竞态条件、多步流程、数组重映射 + 脏值跟踪）
- **TASK-003**：为三个模块添加详细的 jsdoc 注释

## 文件清单

### 修改的文件

- `packages/core/src/form.ts` - 添加 `form/` 子模块的 re-export
- `packages/core/src/index.ts` - 添加新导出到 package barrel
- `packages/core/src/form/validation.ts` - 添加 `createValidationEngine` 和 `ValidationEngine` 的 jsdoc
- `packages/core/src/form/steps.ts` - 添加 `createStepNavigation` 和 `StepNavigation` 的 jsdoc
- `packages/core/src/form/values.ts` - 添加 `createFieldValueOps` 和 `FieldValueOps` 的 jsdoc

### 新增的文件

- `packages/core/src/form/__tests__/validation-engine.test.ts` - `createValidationEngine` 集成测试（14 个测试）
- `packages/core/src/form/__tests__/step-navigation.test.ts` - `createStepNavigation` 集成测试（14 个测试）
- `packages/core/src/form/__tests__/field-value-ops.test.ts` - `createFieldValueOps` 集成测试（40 个测试）

## 核心代码实现

### TASK-001：Barrel 导出

#### `packages/core/src/form.ts`

在文件顶部添加了三个子模块的 re-export，附简短说明注释：

```typescript
export { createValidationEngine, type ValidationEngine } from './form/validation'
export { createStepNavigation, type StepNavigation } from './form/steps'
export {
  createFieldValueOps,
  type FieldValueOps,
  insertItem,
  removeItem,
  swapItems,
  moveItem,
  insertRemap,
  removeRemap,
  swapRemap,
  moveRemap,
  rekeyMetadata,
} from './form/values'
```

#### `packages/core/src/index.ts`

在已有的 form 导出块中追加新导出：

```typescript
export {
  // ... 原有导出 ...
  createValidationEngine,
  type ValidationEngine,
  createStepNavigation,
  type StepNavigation,
  createFieldValueOps,
  type FieldValueOps,
  insertItem,
  removeItem,
  swapItems,
  moveItem,
  insertRemap,
  removeRemap,
  swapRemap,
  moveRemap,
  rekeyMetadata,
} from './form'
```

### TASK-002：集成测试

**`validation-engine.test.ts`** — 14 个测试覆盖：

- 基本功能：无 validator 返回 undefined、运行 validator 返回错误、传递完整 values
- 生命周期回调：`onValidating(true/false)`、`onError` 正确调用
- **异步竞态条件保护**：v1 先发后返回，v2 后发先返回，v1 的过期结果被丢弃
- `isCurrent` 在 validation 完成后返回正确值
- `scheduleValidate` 防抖（`vi.useFakeTimers` + `vi.advanceTimersByTimeAsync`）
- `validateOnChange: false` 时跳过
- `validateForm` 聚合错误、merge 表单级 validate、异常处理

**`step-navigation.test.ts`** — 14 个测试覆盖：

- `stepCount`、`goToStep` 边界值 clamp
- `nextStep` 验证当前步骤字段后前进、验证失败不前进、最后一页不前进
- `prevStep` 递减、不低于 0
- `validateStep` 指定 index / 当前 step、无字段的步骤返回 true
- **完整向导流程**：next→fail→fix→next→prev→next

**`field-value-ops.test.ts`** — 40 个测试覆盖：

- `getFieldValue`、`setFieldValue` 单个字段读写和脏标记
- `Object.is` 语义验证（`Object.is(NaN, NaN)` → not dirty, `Object.is(+0, -0)` → dirty）
- `setValues` 批量更新和脏标记
- 数组操作：`insertItem`、`removeItem`、`swapItems`、`moveItem`（边界值、空数组、不修改原数组）
- 索引重映射：`insertRemap`、`removeRemap`、`swapRemap`、`moveRemap`（前后移动、原地 no-op）
- `rekeyMetadata` 数组变更后 per-element 元数据重映射

### TASK-003：Jsdoc 注释

每个函数和接口都添加了详细的 jsdoc，包括：

- **用途说明**："This is the same engine used internally by `createFormStore`"
- **何时使用**：outside form store context / custom pipeline / custom form engine
- **参数说明**（仅对函数）
- **使用示例**（仅对函数）

### 关键设计决策

1. **前缀注释而非单行 jsdoc**：在 `form.ts` 中使用 `//` 注释而非 `/** */` 避免干扰已有文档结构，保持文件顶部简洁
2. **直接 re-export**：不经过中间包装，保持 tree-shaking 友好
3. **测试隔离**：每个模块独立测试文件，不修改已有测试
4. **使用 `vi.useFakeTimers`** 测试 debounce 时序，避免真实等待

## 验证步骤

| 检查项     | 命令                      | 结果                            |
| ---------- | ------------------------- | ------------------------------- |
| 单元测试   | `npx vitest run`          | 56 files, 809 tests ✅          |
| TypeScript | `npx tsc --noEmit`        | Exit 0 ✅                       |
| 构建       | `npx tsup`                | ESM + DTS success ✅            |
| 类型检查   | Barrel 中类型是否正确暴露 | `dist/index.d.ts` 包含新导出 ✅ |

## 配置要求

无新增配置项。所有新增导出通过已有的 `tsup` 配置自动构建到 `dist/index.js` 和 `dist/index.d.ts`。

## 下一步

已完成 **方向一** 的全部 3 个任务。如需继续，可以从以下方向中选择：

- **方向二（填补 useForm API 空白）**：TASK-004~TASK-008
- **方向三（扩展 CLI）**：TASK-009~TASK-012
- **方向四（跨框架运行时验证）**：TASK-013~TASK-017
- **方向五（弃用/迁移工具）**：TASK-018~TASK-022

请指示要继续实现哪个方向/任务。
