# 韧性层使用示例

所有 9 个 Iris UI 韧性原语的实际使用示例。

## 1. 弹性数据获取

```ts
const api = createResilientFetcher<User[]>({
  ttlMs: 30_000, // 缓存 30 秒
  breaker: { failureThreshold: 5, resetMs: 60_000 },
  rateLimit: { capacity: 10, refillTokens: 10, intervalMs: 1000 },
})

const users = await api.fetch('users', () => fetch('/api/users').then((r) => r.json()))
const cached = await api.fetch('users', () => fetch('/api/users').then((r) => r.json()))
```

## 2. 离线变更队列

```ts
const outbox = createOutbox<{ id: string; data: unknown }>({
  execute: async (payload) => {
    await fetch(`/api/items/${payload.id}`, { method: 'PUT', body: JSON.stringify(payload.data) })
  },
  maxAttempts: 3,
})

outbox.enqueue({ id: '123', data: { name: 'Updated' } })
window.addEventListener('online', () => outbox.flush())
```

## 3. 实时数据连接

```ts
const source = createReconnectingSource<{ type: string; data: unknown }>(
  (sink) => {
    const ws = new WebSocket('wss://example.com/events')
    ws.onmessage = (e) => sink.message(JSON.parse(e.data))
    ws.onopen = () => sink.open()
    ws.onclose = () => sink.close()
    return () => ws.close()
  },
  { onMessage: (msg) => console.log('收到:', msg) },
  { backoffMs: 1000, maxBackoffMs: 30_000 },
)

source.open()
```
