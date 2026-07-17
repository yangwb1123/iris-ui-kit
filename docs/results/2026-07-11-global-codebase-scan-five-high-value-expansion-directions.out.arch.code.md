I can see there are many architecture design documents (`.arch.md`) and implementation plan documents (`.impl-plan.md`) available in the `docs/results/` directory. However, you haven't specified which task or feature you'd like me to implement.

Based on the Tech Lead analysis reports from today (2026-07-12), here are the available implementation tracks:

**From `tech-lead-analysis-five-directions.md`:**

- **BUG-001**: Fix `desktopBridge.ts` async handler silent swallow bug (P0, 0.5h)
- **TASK-001~TASK-009**: CMS共享层 (`@iris-ui/cms-shared` 包创建 + 四倍体逻辑提取)
- **TASK-010~TASK-012**: Desktop TypeScript 化 + preload 桥接类型
- **TASK-013~TASK-015**: Svelte 子路径导出对齐
- **TASK-016~TASK-019**: SSR 测试增强

**From `tech-lead-analysis-code-grounded-five-directions.md`:**

- **DSK-001~DSK-018**: Desktop OS 逻辑下沉到 core
- **MEM-001~MEM-012**: 内存安全 / Disposable 接口
- **DVT-001~DVT-008**: DevTools / MCP 运行时扩展
- **I18N-SSR-001~I18N-SSR-007**: SSR i18n 字典同步
- **I18N-001~I18N-005 / PLG-001~PLG-005**: i18n 管线化 + 插件 store 共享

**Which task would you like me to implement?** Please specify:

1. Which task ID(s) you want implemented (e.g., `BUG-001`, `TASK-001~TASK-003`, `DSK-001`)
2. The corresponding `.arch.md` and `.impl-plan.md` files to use as design documents
3. Or attach the specific design documents directly
