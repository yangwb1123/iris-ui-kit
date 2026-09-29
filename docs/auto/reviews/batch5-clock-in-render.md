已完成：

- 日历支持 `now` 快照与显式 `timeZone`，无注入时 SSR 使用稳定中性值，挂载后启动时钟更新。
- React/Vue/Solid/Svelte 日历渲染器均移除渲染期时钟读取。
- 四端 Countdown 支持可选 `now`，SSR 首帧无剩余文本，挂载后启动倒计时。
- 补充跨午夜、跨月、SSR 与注入快照测试。

验证通过：calendar 全部测试、四端 Countdown 测试、typecheck、svelte-check、ESLint。
