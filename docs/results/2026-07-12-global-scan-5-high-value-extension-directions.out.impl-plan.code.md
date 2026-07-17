---
# 代码实现报告

## 实现概述

在阅读最新的架构分析（`arch.md`）和实现计划（`impl-plan.md`）后，我对 `packages/core/src` 下的相关源码和测试文件进行了全面审计。**关键发现：实现计划中描述的两个代码任务（REAL-T1 和 REAL-T2）已经全部实现并测试通过**。

| 任务 | 描述 | 状态 | 证据 |
|------|------|------|------|
| **REAL-T1** | `flattenNav` 深度截断测试 | ✅ **已实现** | `nav.test.ts` 含 `describe('depth limit')` 4 个测试用例 |
| **REAL-T2** | `parsePath` 原型污染键拒绝 | ✅ **已实现** | `path.ts` 含完整防护逻辑 + `path.test.ts` 含 11+ 测试用例 |
---

## 文件清单

### 已验证已实现的代码

| 文件                             | 说明                                                                       | 测试数 |
| -------------------------------- | -------------------------------------------------------------------------- | ------ |
| `packages/core/src/nav.ts`       | `flattenNav` 含 `MAX_DEPTH=1000` + `seen Set` 双重防护                     | —      |
| `packages/core/src/nav.test.ts`  | 深度截断测试：4 个 `it()` 覆盖超限/恰等于/未超限/正常场景                  | 20     |
| `packages/core/src/path.ts`      | `isKeyReserved` + `validateReservedKeys` + `parsePath` 集成 + `isPathSafe` | —      |
| `packages/core/src/path.test.ts` | 原型污染拒绝：11 个 `it()` 覆盖 6+ 场景 + `isKeyReserved` 6 个             | 59     |

---

## 核心代码实现（已验证）

### REAL-T1: `flattenNav` 深度截断测试

**测试文件**: `packages/core/src/nav.test.ts`

```typescript
describe('depth limit', () => {
  function chain(count: number): NavNode {
    const nodes: NavNode[] = []
    for (let i = 0; i < count; i++) {
      nodes.push({ key: 'node_' + i, title: 'Node ' + i, children: [] })
    }
    for (let i = 0; i < count - 1; i++) {
      nodes[i]!.children = [nodes[i + 1]!]
    }
    nodes[count - 1]!.children = []
    return nodes[0]!
  }

  it('truncates when chain depth exceeds MAX_DEPTH (1000)', () => {
    const root = chain(1002)
    const result = flattenNav([root])
    expect(result).toHaveLength(1001) // 深度 0..1000 = 1001 个节点
    expect(result[0]!.key).toBe('node_0')
    expect(result[1000]!.key).toBe('node_1000') // depth 1000 被包含
    expect(result.find((n) => n.key === 'node_1001')).toBeUndefined() // depth 1001 被截断
  })

  it('does not truncate at exactly MAX_DEPTH levels', () => {
    const root = chain(1001) // 1001 节点 = 0..1000 深度，全部在限制内
    const result = flattenNav([root])
    expect(result).toHaveLength(1001)
    expect(result[1000]!.key).toBe('node_1000')
  })

  it('does not truncate when depth is under limit', () => {
    const root = chain(500)
    const result = flattenNav([root])
    expect(result).toHaveLength(500)
  })

  it('does not affect normal trees with moderate nesting', () => {
    const root = chain(10)
    const result = flattenNav([root])
    expect(result).toHaveLength(10)
  })
})
```

### REAL-T2: `parsePath` 原型污染防护

**核心实现**: `packages/core/src/path.ts`

```typescript
// 保留的原型键集合
const RESERVED_PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// 对外工具函数
export function isKeyReserved(key: string): boolean {
  return RESERVED_PROTOTYPE_KEYS.has(key)
}

// 验证逻辑（在 parsePath 内部调用）
function validateReservedKeys(segments: PathSegment[], input: string): PathSegment[] {
  let found = false
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (typeof seg !== 'string' || !isKeyReserved(seg)) continue
    if (seg === '__proto__') { found = true; break }    // 任意层级拒绝
    if (i > 0) { found = true; break }                    // 嵌套的 constructor/prototype 拒绝
  }
  if (!found) return segments
  // dev 模式 throw, prod 模式 warn + 过滤
  ...
}

// parsePath 签名
export function parsePath(path: Path, options?: { allowReserved?: boolean }): PathSegment[]
```

**测试覆盖**: `packages/core/src/path.test.ts`

| 场景                                  | 测试数 |
| ------------------------------------- | ------ |
| `__proto__` 任意层级拒绝              | 3      |
| `constructor` / `prototype` 嵌套拒绝  | 4      |
| 顶层 `constructor` / `prototype` 允许 | 2      |
| `allowReserved` 选项绕过              | 1      |
| array-form 路径绕过                   | 1      |
| 数字段不误报                          | 1      |
| `isKeyReserved` 工具函数              | 6      |

---

## 测试结果

```
✓ nav.test.ts    — 20 passed (深度截断 4 个全部通过)
✓ path.test.ts   — 59 passed (原型污染 11+ 个全部通过)
```

---

## 关键设计决策

### `parsePath` 原型污染防护的安全策略

1. **`__proto__` 在任何层级拒绝**：即使顶层 `parsePath('__proto__')` 也被拒绝。这是因为 `obj.__proto__` 是直接的原型链访问。

2. **`constructor` / `prototype` 仅嵌套拒绝**：顶层 `parsePath('constructor')` 是合法的属性访问。仅在路径长度 > 1 时拒绝（如 `a.constructor`）。

3. **Dev throw + Prod warn**：开发模式抛出 `PathError` 快速发现 bug；生产模式 `console.warn` + 过滤掉危险段，不中断用户操作。

4. **`allowReserved` 选项**：提供 opt-out 机制，当用户确实需要使用这些键名时（如数据模型中有 `constructor` 字段）。

5. **Array-form 路径绕过**：当传入 `['a', 'constructor']` 时跳过检查，因为这是显式的、不可信的路径。

---

## 验证步骤

两个任务代码已存在且测试通过：

```bash
# 验证 nav 深度截断测试
npx vitest run packages/core/src/nav.test.ts

# 验证 path 原型污染测试
npx vitest run packages/core/src/path.test.ts

# 全量检查
pnpm turbo run test typecheck lint build
```

---

## 结论

实现计划（`2026-07-12-tech-lead-five-directions-implementation-analysis.out.impl-plan.md`）中描述的 **REAL-T1 和 REAL-T2 已经全部实现**。剩余的唯一非代码任务 **REAL-T3**（文档重定位，将分析文档标记为「追溯性复盘」而非「前瞻计划」）属于文档维护工作，建议在文件头部添加横幅：

```
> 状态: 已实现复盘
> 事实核查: 代码已验证全部实现
```

无需任何代码变更。
