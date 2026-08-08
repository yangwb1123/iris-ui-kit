---
'@iris-ui-kit/tokens': minor
'@iris-ui-kit/theme': minor
---

**美学打磨（aesthetic review P1-P15）**

- 新增 token：`surface.floating`（浮层层级，dark 脱离卡片）、`success.foreground` / `danger.foreground` / `info.foreground`（语义色前景 ink，dark 深墨 AA）
- `info` 色相 `#3b82f6 → #0ea5e9`（light）/ `#60a5fa → #38bdf8`（dark）——与 primary 拉开色相，语义不再像"坏掉的 primary"
- `radius.sm` 2 → 4（软化微家族）
- 阴影双层分层（light /0.05+/0.06 系，dark /0.2+/0.4）
- `letter.spacing.tight` -0.01 → -0.02em（display 标题）、`wide` 0.02 → 0.04em（label）
- 浮层入场动效（CSS 变量 + prefers-reduced-motion 归零）、全局 focus-visible ring、Card padding/阴影对齐、Button hover color-mix、Table row hover/selected、Statistic 值 token 化（20/24/30）、Badge sm 12px、Switch 150ms 同步、EmptyState 图标容器、z-index token 化
