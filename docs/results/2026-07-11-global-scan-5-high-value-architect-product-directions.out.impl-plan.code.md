感谢您的角色设定。我已理解整个上下文：

**当前状态**：pi-batch pipeline 刚刚完成了 `technical-design` 阶段，生成了大量 `.arch.md`（架构设计）和 `.impl-plan.md`（实现计划）文件（共约 635 个未提交文件）。现在进入 `code-implementation` 阶段。

我的角色是 **Code Implementer**，需要读取架构设计文档和实现计划文档，然后编写实际代码。

---

**但是，您尚未指定具体要实现哪个需求的代码。** 在 `docs/results/` 目录下有大量的 `.arch.md` 和 `.impl-plan.md` 文件（对应 243 个原始需求）。例如：

- `2026-07-10-architectural-expansion-frontiers.out.arch.md` + `.impl-plan.md`
- `2026-07-10-code-grounded-edge-scroll-keyboard-machine-data.out.arch.md` + `.impl-plan.md`
- `2026-07-10-core-extensions-persistence-animation-window-i18n.out.arch.md` + `.impl-plan.md`
- ...及更多

请您指定：

1. **具体是哪个需求**（输入文件名，如 `2026-07-10-architectural-expansion-frontiers`）
2. 或者是否有特定的 **方向/主题** 您希望我优先实现

一旦您指定，我会：

1. 读取对应的 `.arch.md` 架构设计文档
2. 读取对应的 `.impl-plan.md` 实现计划文档
3. 理解原始需求
4. 在 **`@iris-ui` 项目代码库** 中实际编写代码实现
5. 遵循项目 AGENTS.md 中的原则（逻辑下沉 core、适配器薄桥、四框架对齐、token 驱动等）
