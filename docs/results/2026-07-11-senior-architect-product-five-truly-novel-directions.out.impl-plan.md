已完成。输出文件已写入：

📄 **`docs/requirements/2026-07-11-senior-architect-product-five-truly-novel-directions.out.md`**（433 行，19.9KB）

## 输出概要

### 核心决策

| 方向                        | 原定级 | TL 定级  | 变更                                     |
| --------------------------- | ------ | -------- | ---------------------------------------- |
| D5: notify 错误隔离         | **P0** | **P0**   | ✅ 维持                                  |
| D1: 重入风险                | P1     | P1       | ✅ 维持（含 notifyDepth 补充）           |
| D4: machine stop() 退出语义 | **P1** | **P1**   | ✅ 维持                                  |
| D2: Portal API 分歧         | P2     | P2       | ✅ 维持                                  |
| D3: CMS 应用层重复          | P2     | **→ P3** | ⬇️ 降级（desktop-os 壳层重复优先级更高） |

### 任务分解

17 个可执行任务，预估 ~41 工时，按 4 条独立轨道组织：

```
Track A (Store)     T-001 → T-002+T-003 → T-004     ~10h  P0+P1
Track B (Machine)   T-005 → T-006+T-007 → T-008     ~10h  P1
Track C (Portal)    T-009 → T-010+T-012 → T-011     ~12h  P2
Track D (CMS)       T-013 → T-014~T-016 → T-017     ~15h  P3
```

### 建议执行节奏

- **今天**：合并 T-001（P0，1 行 try/catch → store.ts 加 listener 异常隔离）
- **本周**：完成所有 P0+P1 任务（T-001~T-008）→ 影响 20+ 控制器 + 6 台 machine
- **下周**：Portal 对齐（T-009~T-012）+ CMS 共享包（T-013~T-017，P3）

### 三个「不应该做的事」

1. ❌ 不要在 `try/catch` 中重新抛出异常（打断 notify 链比吞掉更糟）
2. ❌ 不要在 `stop()` 中清理 store listeners（适配器 cleanup 模式靠自管理 unsubscribe）
3. ❌ 不要把 `portalTarget` 下沉到 `IrisProvider` context（scope creep，违反组件独立控制 portal 的设计）
