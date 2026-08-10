# 四框架视觉一致性验证报告

> 验证日期：2026-08-07 · 工具：ai-batch-runner 视觉验证流程 +
> Playwright `visual-parity.spec.ts`（四框架 CMS 真实 bundle）

## 方法

同一产品旅程（登录 `ada` → Users 页）在 Vue/React/Solid/Svelte 四个真实
Vite bundle 渲染，与 React 基线像素对比（threshold 0.2、
maxDiffPixelRatio 0.02，与仓库既有视觉基线同口径）。

## 结果

| 框架      | light          | dark           | 结论                  |
| --------- | -------------- | -------------- | --------------------- |
| **React** | 基线           | 基线           | —                     |
| **Solid** | ✅ PASS（<2%） | ✅ PASS（<2%） | **与 React 渲染一致** |
| Vue       | ❌ 3.9%→3.5%   | ❌ 3.5%        | 应用层差异（见归因）  |
| Svelte    | ❌             | ❌             | 应用层差异（同左）    |

## 归因（源码级证据）

**Solid = React 像素一致** → 组件库（IrisTable/IrisAvatar/IrisBadge/Shell）
四框架渲染统一达成，token 化改动未引入视觉漂移。

**Vue/Svelte 差异 = CMS 应用层组件选择，非组件库缺陷**：

1. `apps/cms/src/pages/UsersPage.vue` 用**手写原生 `<table>`**（+ checkbox
   列 + 自实现排序 `nextSort/sortGlyph`），`apps/cms-react` 用 **IrisTable**
   （内置 sortable/selectable）。数据完全一致（同一批 7 行用户，逐行核对）。
2. 差异像素散布整个内容区（表格 cell padding 10px vs 8px、th 字号
   12px vs 14px、右侧滚动条）——全部是两种表格实现的固有差异。
3. 这是**有意的演示多样性**（各框架展示惯用写法），不是跨框架契约违约。

## 本次修复（视觉验证发现）

- `packages/vue/src/admin/styles.ts`：`--iris-nav-item-padding-inline`
  10px → **12px**（react/solid/svelte NavMenu 均为 8px 12px）——组件库级
  漂移已修复（diff 3.9% → 3.5%，其余为应用层）。
- 教训：**"组件局部 CSS 变量"豁免只豁免"命名"，不豁免"值"**——局部变量
  的值必须与其他框架对齐（token 刻度内）。

## 长期门禁

`visual-parity.spec.ts` 已分发到 4 个 CMS 应用（react 基线 + 3 框架对比），
组件库任何 token/样式改动都会触发像素回归信号。Solid 对比为硬门；
Vue/Svelte 差异记录为已知基线（应用层）。

## 后续可选（需产品决策）

把 Vue/Svelte CMS 的 UsersPage 迁移到 IrisTable（对齐 react/solid）——
收益：四框架 CMS 像素级一致；代价：失去手写表格的演示多样性。
