您好！我已准备好担任 **Code Implementer** 角色，将严格遵循架构设计和实现计划，输出高质量的代码实现。

基于我对项目结构和文档的分析，我注意到以下可用文档资源：

---

## 项目当前状态

| 文档类型                       | 位置                 | 最新版本                                                         |
| ------------------------------ | -------------------- | ---------------------------------------------------------------- |
| **需求文档**                   | `docs/requirements/` | 多份 `2026-07-11` 方向分析                                       |
| **架构设计** (`.arch.md`)      | `docs/results/`      | ~40 份架构评审文档                                               |
| **实现计划** (`.impl-plan.md`) | `docs/results/`      | ~40 份实现计划文档                                               |
| **Tech Lead 分析**             | `docs/tech-lead/`    | `2026-07-12-tech-lead-analysis-code-grounded-five-directions.md` |

---

## 可用的实施方向

从最新的 Tech Lead 分析看，**P0 优先级**方向有：

### 方向①：Desktop OS 逻辑下沉（DSK-001 ~ DSK-018）

将四框架重复的 ~2079 行纯逻辑（depth/os/permissions/catalog/remoteApp/planner/wm 等）下沉至 `@iris-ui/core/desktop`

### 方向④：内存安全 / Disposable 接口（MEM-001 ~ MEM-012）

定义 `Disposable` 类型，为 `createStore`/`createMachine`/`createSelectionModel` 等核心工厂实现 `destroy()`，加上四框架 unmount 适配

### 方向⑥：SSR i18n 字典同步（I18N-SSR-001 ~ I18N-SSR-007）

`serialize()`/`hydrate()` 方法 + 四框架 SSR 适配 + 测试

---

请告诉我：

1. **您希望我实现哪个具体方向或任务？**（例如：DSK-001 ~ DSK-002、MEM-001 ~ MEM-005、或某个完整方向）
2. **应参考哪份架构设计文档和实现计划文档？**（例如：`docs/results/2026-07-11-global-scan-five-genuine-code-grounded-directions.out.arch.md`）
3. **是否有时间或优先级要求？**
