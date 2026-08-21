# 批 CY：窄容器响应式列折叠

## Implementation

已完成 `batch-cy-baseline.md` 定义的 React 桥：

- `packages/core/src/responsive.ts` 提供框架无关的 `computeResponsiveColumns`，严格处理
  479/480/481 边界、固定列、分组列自然宽度、最小保留列和非法宽度 fail-closed。
- React 表格以独立 `ResizeObserver` 测量根容器；响应式开关关闭、SSR/jsdom 无 observer 或
  宽度不窄时保持原引用和原渲染路径。
- 折叠结果进入统一的 `responsiveDisplayColumns → leafColumns` 通道，覆盖表头、正文、
  footer、列虚拟化、列宽、合并计划和当前视图导出。
- 折叠后仍超宽时，在表根与 pager 之间显示 token-only `data-iris-scroll-hint`；zoom 和
  printable 模式隐藏提示。

## Verification

- core `responsive.test.ts`: 12 tests passed。
- React `responsive-narrow.test.tsx`: 20 tests passed。
- 覆盖 off/no-ResizeObserver/479/480/481、widen restore、固定列与 floor、columnOrder、
  visibility、grouped、detail/selection tracks、controlled widths、header merge、zoom 和
  printable，以及 root `clientWidth=0` 时忽略陈旧 `ResizeObserver.contentRect` 的
  fail-closed 回归。
- `@iris-ui-kit/core` + `@iris-ui-kit/react` typecheck/lint/build passed（lint 仅保留既有
  complexity warnings）。
