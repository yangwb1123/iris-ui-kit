# 韧性层使用示例

所有 9 个 Iris UI 韧性原语的实际使用示例。

## 基础设置

```ts
import { createResilientFetcher, createOutbox, createDisposableScope } from '@iris-ui/core'
```

## 1. 弹性数据获取

结合缓存、熔断器和限流器，构建强化的 API 客户端：

```ts
const api = createResilientFetcher<User[]>({
  ttlMs: 30_000, // 缓存 30 秒
  breaker: {
    // 5 次失败后触发熔断
    failureThreshold: 5,
    resetMs: 60_000, // 1 分钟后尝试恢复
  },
  rateLimit: {
    // 每秒最多 10 个请求
    capacity: 10,
    refillTokens: 10,
    intervalMs: 1000,
  },
})

// 首次调用：从网络获取
const users = await api.fetch('users', () => fetch('/api/users').then((r) => r.json()))

// 30 秒内的再次调用：立即返回缓存数据
const cached = await api.fetch('users', () => fetch('/api/users').then((r) => r.json()))

// 5 次失败后：熔断器打开，后续调用立即抛出异常
```

## 2. 离线变更队列

离线时排队变更，重连后自动回放：

```ts
const outbox = createOutbox<{ id: string; data: unknown }>({
  execute: async (payload) => {
    await fetch(`/api/items/${payload.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload.data),
    })
  },
  maxAttempts: 3,
})

// 入队变更（立即持久化）
outbox.enqueue({ id: '123', data: { name: 'Updated' } })

// 刷新队列（按顺序重试失败项）
window.addEventListener('online', () => outbox.flush())
```

## 3. 实时连接 + 自动重连

```ts
const source = createReconnectingSource<{ type: string; data: unknown }>(
  (sink) => {
    const ws = new WebSocket('wss://example.com/events')
    ws.onmessage = (e) => sink.message(JSON.parse(e.data))
    ws.onopen = () => sink.open()
    ws.onerror = (e) => sink.error(e)
    ws.onclose = () => sink.close()
    return () => ws.close()
  },
  {
    onMessage: (msg) => console.log('收到:', msg),
    onStatus: (status) => console.log('连接状态:', status),
  },
  { backoffMs: 1000, maxBackoffMs: 30_000 },
)

source.open()
// 断开后：自动以 1s → 2s → 4s → … → 30s 指数退避重连
```

## 4. 生命周期管理

```ts
const scope = createDisposableScope()

// 注册清理回调
scope.add(() => console.log('清理中...'))
scope.addTimeout(setInterval(() => {}, 1000))

// 自动清理所有注册的资源
scope.destroy() // 按注册顺序的逆序执行所有清理
```

## 5. 事件总线 — 跨插件通信

```ts
const bus = createEventBus<{
  'user:login': { userId: string }
  'data:updated': { table: string }
}>()

bus.on('user:login', ({ userId }) => console.log('用户登录:', userId))
bus.emit('user:login', { userId: '123' })
```

## 6. 完整示例：React 组件

```tsx
import { useEffect, useState } from 'react'
import { useResilientFetcher, useReconnectingSource, useDisposableScope } from '@iris-ui/react'

function Dashboard() {
  const scope = useDisposableScope()
  const api = useResilientFetcher<{ data: string[] }>({ ttlMs: 10_000 })
  const [data, setData] = useState<string[]>([])
  const [status, setStatus] = useState<string>('connecting')

  // 弹性数据获取
  useEffect(() => {
    api
      .fetch('dashboard-data', async () => {
        const res = await fetch('/api/dashboard')
        return res.json()
      })
      .then((result) => setData(result?.data ?? []))
  }, [])

  // 实时连接
  const connectionStatus = useReconnectingSource<{ update: string }>(
    (sink) => {
      const ws = new WebSocket('wss://example.com/live')
      ws.onmessage = (e) => sink.message(JSON.parse(e.data))
      ws.onopen = () => sink.open()
      ws.onclose = () => sink.close()
      return () => ws.close()
    },
    {
      onMessage: (msg) => setData((prev) => [...prev, msg.update]),
      onStatus: (s) => setStatus(s),
    },
  )

  return (
    <div>
      <p>状态: {connectionStatus}</p>
      <ul>
        {data.map((d, i) => (
          <li key={i}>{d}</li>
        ))}
      </ul>
    </div>
  )
}
```

## 原语参考表

| 原语                       | 用途               | 适用场景             |
| -------------------------- | ------------------ | -------------------- |
| `createDisposableScope`    | 生命周期清理       | 组件卸载时自动清理   |
| `createEventBus`           | 类型化发布/订阅    | 跨插件消息通信       |
| `createQueryCache`         | 去重 + TTL + SWR   | 缓存 API 响应        |
| `createCircuitBreaker`     | 故障隔离           | 保护下游服务         |
| `createRateLimiter`        | 令牌桶限流         | 限制 API 调用频率    |
| `createResilientFetcher`   | 缓存 + 熔断 + 限流 | 强化 API 客户端      |
| `createOutbox`             | 离线变更队列       | 离线支持             |
| `createReconnectingSource` | 实时 + 退避重连    | 实时数据流           |
| `createDataSource`         | 统一数据引擎       | 表格/列表分页 + 弹性 |
