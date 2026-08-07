---
'@iris-ui-kit/tokens': minor
'@iris-ui-kit/theme': minor
---

**设计系统刻度补全 + 全仓 token 统一**

- 新增 font.size 完整刻度（xs/sm/md/base/lg/xl/2xl/3xl/4xl = 12/13/14/15/16/18/20/24/30）+ font.weight / line.height / letter.spacing 家族
- 新增 space.xxs~5xl 4pt 间距刻度 + control.height.sm/md/lg（28/34/40）
- 新增 shadow.xl（浮层大阴影）、on.color、warning.foreground（彩色表面前景对比度纪律）
- **注意**：`iris.font.size.md` 15px → 14px、`iris.font.size.lg` 18px → 16px（消费面仅 drawer/charts，属刻度统一的一部分）
- 全仓组件样式迁移为 var(--iris-*) 驱动（589 处违规归零：裸字号/魔法间距/fallback 漂移/硬编码阴影）
- 插件注册 token 恢复嵌套 var 消费（宿主可覆盖）
