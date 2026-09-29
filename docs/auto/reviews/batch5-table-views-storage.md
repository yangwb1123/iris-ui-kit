已完成：

- core 默认 storage 增加 SSR 安全保护。
- React/Vue/Solid/Svelte 均改为挂载后读取视图，首帧使用空默认列表。
- React 统一复用 core 读写逻辑。
- 补充 SSR、挂载恢复、storage 异常测试。

验证通过：core、四端 table 相关测试及 typecheck。
