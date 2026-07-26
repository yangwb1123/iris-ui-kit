# 数据与韧性层

Iris UI 提供一套完整的数据层，内置韧性原语——全部在 `@iris-ui/core` 中，框架无关。

## 架构总览

```
┌─────────────────────────────────────────────────────────┐
│                    应用层                                 │
│  useResourceController  │  IrisProTable  │  IrisTable    │
├─────────────────────────────────────────────────────────┤
│                    数据源 (createDataSource)              │
│  fetcher  │  pagination  │  selection  │  mutate         │
├─────────────────────────────────────────────────────────┤
│                    韧性层                                 │
│  ┌─────────────────────────────────────────────────┐    │
│  │  createResilientFetcher                         │    │
│  │  ├── createQueryCache      (去重 + TTL + SWR)  │    │
│  │  ├── createCircuitBreaker  (故障隔离)            │    │
│  │  └── createRateLimiter     (令牌桶)             │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  createOutbox              (离线变更队列)        │    │
│  ├─────────────────────────────────────────────────┤    │
│  │  createReconnectingSource  (实时 + 退避重连)     │    │
│  └─────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────┤
│                    生命周期                               │
│  createDisposableScope  │  createEventBus                │
└─────────────────────────────────────────────────────────┘
```

## 查询缓存 (createQueryCache)

去重并发请求，使用 TTL 缓存结果，并在重新验证时提供陈旧数据 (SWR)：

```ts
const cache = createQueryCache<User[]>({ ttlMs: 30_000 })

// 首次调用：发起请求
const users = await cache.fetch('all-users', fetchUsers)

// 30 秒内的第二次调用：立即返回缓存数据
const cached = await cache.fetch('all-users', fetchUsers)
```

## 熔断器 (createCircuitBreaker)

隔离故障端点，防止级联失败：

```ts
const breaker = createCircuitBreaker({
  failureThreshold: 3,  // 3 次失败后触发熔断
  resetMs: 30_000,      // 30 秒后尝试恢复
})

// 包装任意异步操作
const result = await breaker.run(() => fetch('/api/data'))
```

## 限流器 (createRateLimiter)

令牌桶限流，保护下游服务：

```ts
const limiter = createRateLimiter({
  capacity: 10,          // 最多突发 10 个请求
  refillTokens: 5,       // 每次补充 5 个令牌
  intervalMs: 1000,      // 每秒补充一次
})

if (limiter.tryRemove()) {
  await fetch('/api/data')   // 允许请求
} else {
  // 被限流 —— 等待 `limiter.timeUntil()` 毫秒
}
```

## 弹性获取器 (createResilientFetcher)

将三个原语组合成一个弹性获取器：

```ts
const rf = createResilientFetcher<User[]>({
  ttlMs: 10_000,
  breaker: { failureThreshold: 3, resetMs: 30_000 },
  rateLimit: { capacity: 5, refillTokens: 2, intervalMs: 1000 },
})

// 单次调用：缓存 + 熔断器 + 限流器同时生效
const users = await rf.fetch('all-users', fetchUsers)
```

## 离线队列 (createOutbox)

保证至少一次、按顺序的变更投递：

```ts
const outbox = createOutbox<{ id: string; data: unknown }>({
  execute: async (payload) => {
    await api.update(payload.id, payload.data)
  },
  maxAttempts: 5,
})

// 入队变更（立即持久化）
outbox.enqueue({ id: '123', data: { name: 'New Name' } })

// 刷新队列（重试失败项）
await outbox.flush()

// 观察队列状态
outbox.subscribe((items) => console.log(items))
```

## 实时数据源 (createReconnectingSource)

基于指数退避的自动重连，适用于任意推送传输：

```ts
const source = createReconnectingSource<StockTick>(
  (sink) => {
    const ws = new WebSocket('wss://example.com/stocks')
    ws.onmessage = (e) => sink.message(JSON.parse(e.data))
    ws.onopen = () => sink.open()
    ws.onerror = (e) => sink.error(e)
    ws.onclose = () => sink.close()
    return () => ws.close()
  },
  {
    onMessage: (tick) => updatePrice(tick),
    onStatus: (status) => setConnectionState(status),
  },
  { backoffMs: 1000, maxBackoffMs: 30_000 },
)

source.open()
// 断开连接后：自动以 1s → 2s → 4s → … → 30s 指数退避重连
```

## 数据源 (createDataSource)

统一数据引擎，为 IrisTable、IrisProTable 和 `useResourceController` 提供支持。它组合了上述所有能力：

```ts
const ds = createDataSource<User>({
  fetcher: (query) => api.fetchUsers(query),
  pageSize: 20,
  // 启用弹性
  resilient: { ttlMs: 10_000, breaker: { failureThreshold: 3, resetMs: 30_000 } },
  // 启用离线变更
  outbox: { maxAttempts: 3 },
})
```

## 生命周期 (createDisposableScope)

每个韧性原语都与 Iris 的可释放生命周期集成：

```ts
const scope = createDisposableScope()
const source = createReconnectingSource(...)
rf.cache.clear = scope.add(() => rf.cache.clear())

// 销毁时：所有资源被清理
scope.destroy()
```

`createAsyncResource` 控制器已实现 `Disposable` 接口：

```ts
const resource = createAsyncResource(fetchData)
// ... 使用它 ...
resource.destroy() // 取消正在进行的请求，清理资源
```
