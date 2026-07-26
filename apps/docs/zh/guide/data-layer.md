# 数据与韧性层

Iris UI 提供一套完整的框架无关数据层，包含 9 个韧性原语。

## 架构总览

```
createDisposableScope  ─── 生命周期自动清理
createEventBus         ─── 跨插件消息总线
createQueryCache       ─── 缓存去重 + TTL + SWR
createCircuitBreaker   ─── 故障隔离
createRateLimiter      ─── 令牌桶限流
createResilientFetcher ─── 弹性数据获取（缓存+熔断+限流）
createOutbox           ─── 离线变更队列
createReconnectingSource ── 实时数据源（指数退避重连）
createDataSource       ─── 统一数据引擎
```

## 快速使用

```ts
import { createResilientFetcher } from '@iris-ui/core'

const api = createResilientFetcher<User[]>({
  ttlMs: 30_000,
  breaker: { failureThreshold: 3, resetMs: 30_000 },
  rateLimit: { capacity: 10, refillTokens: 10, intervalMs: 1000 },
})

const users = await api.fetch('users', () => fetch('/api/users').then((r) => r.json()))
const cached = await api.fetch('users', () => fetch('/api/users').then((r) => r.json()))
```

## React Hooks

```tsx
import { useResilientFetcher } from '@iris-ui/react'

function UserList() {
  const api = useResilientFetcher<User[]>({ ttlMs: 30_000 })
  // ...
}
```

> 完整文档请参考[英文版](/guide/data-layer)。
