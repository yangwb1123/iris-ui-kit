已生成 Tech Lead 分析报告并保存至：

**📄 `/home/u1/iris-ui/docs/tech-lead/2026-07-12-tech-lead-analysis-code-grounded-five-directions.md`**（24.6KB）

---

## 分析摘要

### 方向优先级重排（采纳架构评审修正）

| 方向                      | 修订后优先级 | 总任务数             | 预估总工时 |
| ------------------------- | ------------ | -------------------- | ---------- |
| ① Desktop OS 逻辑下沉     | **P0**       | 18 (DSK-001~018)     | ~43h       |
| ④ 内存安全/Disposable     | **P0**       | 12 (MEM-001~012)     | ~41h       |
| ③+⑦ DevTools/MCP 运行时   | **P1**       | 8 (DVT-001~008)      | ~31h       |
| ⑥ SSR i18n 字典同步（新） | **P1**       | 7 (I18N-SSR-001~007) | ~15h       |
| ② i18n 管线化 → **P2**    | **P2**       | 5 (I18N-001~005)     | ~20h       |
| ⑤ 插件 store 共享         | **P2**       | 5 (PLG-001~005)      | ~17h       |

### 关键发现

1. **P0 组可并行**：Desktop OS 下沉和 Disposable 接口互不依赖，可 4 人并行推进，6 周内交付 MVP
2. **`batch()` 已存在**：方向④建议的批处理 API 在 `store.ts:34` 已实现，但未被广泛使用——需要推广而非新建
3. **核心风险在 catalog.ts 差异**：四份 `catalog.ts` 共 1278 行，但存在语义差异，合并需额外 review
4. **MCP WebSocket 桥接**：⑦是 DevTools 方向的最大技术冒险（无先例），建议先做 1 天 POC
5. **最小可行发布点**：Week 6（P0 完成即可发布 `@iris-ui/core` 补丁包）

### 团队建议

最小团队 **3 人**（1 core + 1 React + 1 多框架 + 0.5 DevOps），推荐 **5 人**（+1 core +1 全栈工具）。
