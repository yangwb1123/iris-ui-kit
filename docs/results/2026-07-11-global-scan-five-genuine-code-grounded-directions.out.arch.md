已完成架构评估文档，输出至：

**`docs/results/2026-07-11-global-scan-five-genuine-code-grounded-directions.out.arch.md`**（13.6KB）

### 评估摘要

对原分析文档 5 个方向逐一的架构评审结果：

| 方向                  | 原文档优先级 | 修订优先级          | 核心分歧                                                                              |
| --------------------- | ------------ | ------------------- | ------------------------------------------------------------------------------------- |
| ① Desktop OS 逻辑下沉 | P0           | **P0** ✅ 一致      | 建议下沉粒度控制：只下沉纯逻辑，`os.ts` 的 chrome 配置保持为数据文件                  |
| ② i18n 管线化         | P1           | **P2** ⬇️ 下调      | 文档遗漏了更优先的 **SSR i18n 字典同步**问题；管线化是加法，同步是必须                |
| ③ DevTools/可观测性   | P1           | **P1** 不变但重定向 | **MCP 运行时扩展**优先（与 AI 原生定位一致），浏览器扩展后置                          |
| ④ 内存安全/GC         | P0           | **P0** ✅ 一致      | 补充了 **StrictMode 幂等 subscribe** 机制——文档未覆盖的 React 特有风险                |
| ⑤ 插件事件总线        | P2           | **P2** 不变但改方案 | 用**声明式 store 共享**替代事件总线（全局事件总线是反模式，Iris 已有 store 订阅模型） |

### 关键新发现（文档未覆盖）

1. **方向间的依赖关系**：方向四（Disposable 接口）是方向三（DevTools 仪表盘）和方向五（插件 store 共享）的**前置条件**
2. **MCP 运行时传输层**：文档未讨论 MCP Server 与浏览器进程不共享内存的问题——需要 WebSocket 或 Chrome DevTools Protocol 桥接
3. **方向二缺少 SSR 同步分析**：i18n 字典在服务端/客户端间不同步会导致水合失败，比提取管线更优先

### 实施路线图（修订版）

- **Sprint 1-2** (P0)：Desktop OS 下沉 + Disposable 接口 + 幂等 subscribe + batch API
- **Sprint 3-5** (P1)：SSR i18n 同步 + MCP 运行时扩展 + Store GC 钩子
- **Sprint 6-8** (P2)：i18n key 扫描 CI 门 + DevTools MVP + 声明式跨插件 store 共享
- **Sprint 9-12** (P3)：i18n 完整管线 + 组件检查器 + 插件版本化依赖
