已完成：

- 四端 Divider 及 Command Palette 统一使用 `--iris-font-letter-spacing-wide`。
- Solid/Svelte 移除硬编码 `0.05em`。
- 删除 `scripts/audit-tokens.mjs` 中对应例外。
- 补充四框架 Divider/Command Palette 样式断言测试。

验证通过：

- `pnpm audit:tokens`：Audit clean
- 四端相关 Vitest 测试全部通过
