All budgets pass. Let me provide the final implementation report.

---

# 代码实现报告

## 实现概述

基于 Tech Lead 分析报告 `2026-07-12-tech-lead-five-directions-implementation-analysis.out.impl-plan.md` 中识别的剩余缺口，实现了两个补缺任务：

1. **REAL-T1**: 为 `flattenNav` 补充深度截断测试（nav.test.ts）
2. **REAL-T2**: 为 `parsePath` 添加原型污染键拒绝机制（path.ts + path.test.ts）

遵循项目现有约定：TypeScript strict、`process.env.NODE_ENV` dev/prod 双模式、try/catch 适配 Vitest 测试环境、JSDoc 文档完整。

## 文件清单

| 文件                             | 操作 | 说明                                                                                                                                             |
| -------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/nav.test.ts`  | 修改 | 新增 `depth limit` 测试套件（4 个 `it`）                                                                                                         |
| `packages/core/src/path.ts`      | 修改 | 新增 `isKeyReserved`、`RESERVED_PROTOTYPE_KEYS`、`validateReservedKeys`；修改 `parsePath` 签名支持 `allowReserved`；更新 `isPathSafe` 检查原型键 |
| `packages/core/src/path.test.ts` | 修改 | 新增 `isKeyReserved` 测试套件（6 个 `it`）+ 原型污染拒绝测试套件（12 个 `it`）+ `isPathSafe` 原型键测试（5 个 `it`）                             |
| `packages/core/src/index.ts`     | 修改 | 导出 `isKeyReserved`                                                                                                                             |

---

## 核心代码实现

### REAL-T1: `flattenNav` 深度截断测试

**文件**: `packages/core/src/nav.test.ts`

在现有的 `describe('cycle protection', ...)` 之后新增 `describe('depth limit', ...)` 套件：

```ts
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
    expect(result).toHaveLength(1001)
    expect(result[0]!.key).toBe('node_0')
    expect(result[1000]!.key).toBe('node_1000')
    expect(result.find((n) => n.key === 'node_1001')).toBeUndefined()
  })

  it('does not truncate at exactly MAX_DEPTH levels', () => {
    const root = chain(1001)
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

**关键设计决策**: 测试覆盖了边界链长度（1002 = 超 1 层、1001 = 恰好 MAX_DEPTH+1 层、500 = 远低于限制、10 = 常规树）。迭代构造避免递归栈溢出。

### REAL-T2: `parsePath` 原型污染防护

**文件**: `packages/core/src/path.ts`

#### `isKeyReserved` — 检查是否为保留原型键

```ts
const RESERVED_PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export function isKeyReserved(key: string): boolean {
  return RESERVED_PROTOTYPE_KEYS.has(key)
}
```

#### `parsePath` 签名扩展 + 保留键校验

```ts
export function parsePath(path: Path, options?: { allowReserved?: boolean }): PathSegment[] {
  // ... 现有解析逻辑不变 ...

  // 新增：原型污染键检查（skip when options.allowReserved is true）
  if (!options?.allowReserved) {
    const checked = validateReservedKeys(segments, str)
    if (checked !== segments) return checked
  }

  return segments
}
```

#### `validateReservedKeys` — 核心校验函数

```ts
function validateReservedKeys(segments: PathSegment[], input: string): PathSegment[] {
  let found = false

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (typeof seg !== 'string' || !isKeyReserved(seg)) continue

    // __proto__ 在任何层级都危险（包括顶层）
    if (seg === '__proto__') {
      found = true
      break
    }

    // constructor / prototype 仅在嵌套上下文危险（索引 > 0）
    if (i > 0) {
      found = true
      break
    }
  }

  if (!found) return segments

  const msg = 'parsePath: path contains reserved key(s) that could enable prototype pollution'
  if (process.env.NODE_ENV === 'development') {
    throw new PathError(msg, input)
  }
  console.warn('[iris-ui] ' + msg + ' — reserved keys removed (path: "' + input + '")')

  // 生产模式：过滤掉危险段
  return segments.filter((seg, i) => {
    if (typeof seg !== 'string' || !isKeyReserved(seg)) return true
    if (seg === '__proto__') return false
    if (i > 0) return false
    return true
  })
}
```

#### `isPathSafe` 更新

```ts
export function isPathSafe(path: string): boolean {
  // ... 现有检查 ...

  // 新增：原型键检查
  const segments = parsePath(path, { allowReserved: true })
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (typeof seg !== 'string' || !isKeyReserved(seg)) continue
    if (seg === '__proto__') return false
    if (i > 0) return false
  }
  return true
}
```

---

## 关键设计决策

| 决策                               | 选择                                                | 理由                                                                                  |
| ---------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `__proto__` 拒绝层级               | **所有层级**，包括顶层 `parsePath('__proto__')`     | 即使顶层 `obj.__proto__ = value` 也是直接的原型污染                                   |
| `constructor`/`prototype` 拒绝层级 | **仅嵌套**（索引 > 0）                              | `obj.constructor` 是合法属性访问；`obj.a.constructor` 可链式访问到 `Object.prototype` |
| `allowReserved` 选项               | 可选参数 `parsePath(path, { allowReserved: true })` | 提供逃生口，不影响现有调用                                                            |
| 生产模式行为                       | `console.warn` + 过滤危险段                         | 与现有 `pathError` 模式一致，防御性安全                                               |
| `isKeyReserved` 导出               | 从 `@iris-ui/core` 导出                             | 供外部调用者检查路径安全性                                                            |

## 依赖说明

无新增依赖。修改全部在 `@iris-ui/core` 包内。

## 质量验证

```bash
pnpm turbo run test typecheck lint build --filter=@iris-ui/core
# 结果：全部通过
# 测试：968 passed, 59 test files
# 尺寸：@iris-ui/core 27.8KB / 28KB gzip (ok)
```

## 已知限制

- 数组形式的 Path（`['a', 'constructor']`）直接绕过保留键检查——因为该形式是显式的精确路径，调用者应自行负责安全性。
- `escapePathSegment` 不会自动 escape 保留键——`escapePathSegment('constructor')` 返回 `['constructor']`，如果在嵌套上下文中使用仍需注意。
