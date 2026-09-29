# Token / 主题 / RTL / 减动效审查

基线：`pnpm audit:tokens` 通过；未计入合法 fallback、插件声明 token、坐标计算及已审阅 component-local 变量。未修改文件。

| ID     | 严重度 | 文件                                                                                 | 一句话症状                                                                                     |
| ------ | ------ | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| AUD-01 | P0     | `packages/theme/src/applyTheme.ts:72-80`；各框架 Dialog 默认 portal                  | 使用局部 `target` 时，默认 `body` portal 不继承主题 CSS 变量与 `dir`，暗色/RTL 直接失效。      |
| AUD-02 | P1     | `packages/theme/src/globalStyles.ts:20,92-97`                                        | 减动效规则仅匹配 `[data-iris-theme]` 子树，局部主题的 portal 或无 ThemeProvider 组件不受保护。 |
| AUD-03 | P1     | 四框架 `primitives/carousel`                                                         | `prefers-reduced-motion` 只在初始化读取，系统偏好运行时变化后 autoplay 不停止或不恢复。        |
| AUD-04 | P1     | `packages/solid/src/primitives/command-palette/IrisCommandPalette.tsx:306`           | 快捷键 badge 使用裸 `rgba(0,0,0,0.1)`，绕过主题。                                              |
| AUD-05 | P1     | `packages/solid/src/primitives/carousel/IrisCarousel.tsx:235`                        | 非激活指示点使用裸白色，和其他框架的 `--iris-border` 不一致。                                  |
| AUD-06 | P1     | `packages/vue/src/primitives/slider/Slider.ts:193`                                   | Slider idle thumb 使用裸黑色阴影，未使用 `--iris-shadow-sm`。                                  |
| AUD-07 | P1     | `packages/svelte/src/primitives/split-button/IrisSplitButton.svelte:175`             | 下拉菜单使用裸阴影，换肤后不跟随 `--iris-shadow-lg`。                                          |
| RTL-01 | P2     | 四框架 `primitives/table` tree 渲染                                                  | 树缩进和 caret 间距使用 `padding-left` / `margin-right`，RTL 下层级方向错误。                  |
| RTL-02 | P2     | 四框架 `primitives/table` resize handle                                              | 列调整手柄固定 `right: 0`，RTL 下不在 inline-end。                                             |
| RTL-03 | P2     | `solid/transfer/IrisTransfer.tsx:270`；`svelte/transfer/IrisTransfer.svelte:189,304` | 计数使用 `margin-left: auto`，RTL 下不会稳定贴合 inline-end。                                  |
| RTL-04 | `P2`   | `packages/svelte/src/primitives/split-button/IrisSplitButton.svelte:162`             | `border-inline-start` 与物理 `border-right` 在 RTL 重叠，外侧边框位置错误。                    |
| RTL-05 | P2     | `packages/svelte/src/primitives/textarea/IrisTextarea.svelte:155`                    | 字数计数器固定在物理右下角，RTL 下应位于 inline-end。                                          |
| RTL-06 | P2     | `packages/react/src/primitives/table/styles.ts:51`；`Table.tsx:7855,8092`            | 表格 range/settings/batch 面板使用物理 `left/right`，RTL 对齐边缘错误。                        |

## 修复与验证建议

- **AUD-01**：由 Provider 提供 portal root，或将主题变量与 `dir` 同步到 body portal host。测试局部 `target + RTL + dark theme + Dialog/Popover`。
- **AUD-02**：让 portal 落在主题作用域内，或为 standalone/portal root 安装独立 reduced-motion 样式。测试 `matchMedia(reduce)` 下的 portal transition。
- **AUD-03**：四框架复用 `usePrefersReducedMotion` / `watchMediaQuery`，并将状态纳入 autoplay effect。测试运行中切换媒体查询。
- **AUD-04**：改为 `var(--iris-background)`（可补 `--iris-border`）。
- **AUD-05**：改为 `var(--iris-border)`。
- **AUD-06**：改为 `var(--iris-shadow-sm)`。
- **AUD-07**：改为 `var(--iris-shadow-lg)`。
- **RTL-01**：改用 `padding-inline-start`、`margin-inline-end`。
- **RTL-02**：改用 `inset-inline-end: 0`。
- **RTL-03**：改用 `margin-inline-start: auto`。
- **RTL-04**：将 `border-right` 改为 `border-inline-end`。
- **RTL-05**：将 `right: 8px` 改为 `inset-inline-end: 8px`。
- **RTL-06**：分别改为 `inset-inline-start/end`。

## 自动化门禁建议

新增：

- `scripts/check-hardcoded-colors.mjs`：禁止 UI 样式中的裸 hex/rgba/阴影；允许主题定义、`var(..., fallback)`、颜色选择器和明确的数据颜色。
- `scripts/check-css-vars.mjs`：校验 canonical/derived/plugin token；component-local 变量必须有带 owner、原因和测试的显式 allowlist。
- `scripts/check-logical-properties.mjs`：禁止组件 UI 中的物理 inline-axis 属性；允许坐标对象、物理 API（如 drawer side）和完整 `left+right` 跨度。
- `scripts/check-theme-motion.mjs`：运行四框架矩阵测试：局部主题 portal、RTL、dark/custom skin、运行时切换 reduced-motion。
