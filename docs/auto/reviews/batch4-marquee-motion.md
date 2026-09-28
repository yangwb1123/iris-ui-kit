已完成：

- 新增 `packages/core/src/media-query.ts`：统一订阅 `MediaQueryList`，使用 Disposable 清理。
- 四端 Marquee 支持减弱动效动态切换：reduce 时取消动画，恢复时重新启动。
- 四端分别补充 `matchMedia` 切换及卸载清理测试。

验证通过：

- React / Vue / Solid / Svelte Marquee 测试全绿
- 四端 `typecheck` 通过
- Svelte `svelte-check`：0 errors / 0 warnings
- Core build 通过
