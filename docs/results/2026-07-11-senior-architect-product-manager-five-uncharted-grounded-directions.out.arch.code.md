现在我对整个项目有了清晰的了解。我已经阅读了：

1. **项目上下文** (AGENTS.md) — Iris UI 的原则和架构
2. **架构文档** (`*.arch.md`) — 5 个方向的结构性分析
3. **实施计划** (`*.impl-plan.md`) — 详细的任务分解
4. **TODO / ROADMAP** — 已完成事项和待办事项
5. **当前技术负责分析** — 优先级和风险评估

项目目前处于良好状态（127/127 测试通过，四框架对齐），但仍有几个**高层次的方向**已确定并在实施计划中详细记录。

以下是基于实施计划的待办事项摘要：

| 方向                          | 优先级 | 任务                                                                                                                                        | 工时估算 |
| ----------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **① Behaviors 下沉到 Core**   | **P0** | 创建 `createResizable`, `createDraggable`, `createClickOutside`, `createMovable`, `createHotkey` 控制器 + 四框架薄桥重构 (~3700 行减少重复) | ~26h     |
| **② Toast Store 提取到 Core** | **P0** | `createToastStore` + 四框架适配器 (~300 行 → 0 重复)                                                                                        | ~5h      |
| **③ Token 审计与修复**        | P1     | 扩展 audit-tokens.mjs，修复非标准 token                                                                                                     | ~8h      |
| **④ 数据导入管线**            | P1     | `fromCsv`/`fromJson` + `plugin-importer` 骨架                                                                                               | ~10h     |
| **⑤ 跨标签页同步**            | P2     | `createCrossTabBus` + `createCrossTabSync`                                                                                                  | ~10h     |

**请问您想让我实现哪个具体任务？** 请指定：

1. **一个具体的实施计划文档**（例如 `2026-07-11-senior-architect-truly-novel-five-gaps.out.impl-plan.md`）
2. **和该计划中的一个具体任务**（例如 `BHV-001: Core createResizable 控制器` 或 `TST-001: Core createToastStore`）

我会严格按照架构设计、实施计划和项目约定生成高质量的实现代码，包括所有测试、类型和文档。
