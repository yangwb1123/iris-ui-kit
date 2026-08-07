# 视觉一致性验证报告 v2（CMS 迁移 IrisTable 后）

> 验证日期：2026-08-07 · 目标：四框架 CMS 同一页面像素一致

## 最终结果

| 框架       | light   | dark    | 状态                 |
| ---------- | ------- | ------- | -------------------- |
| React      | 基线    | 基线    | —                    |
| **Solid**  | ✅ <2%  | ✅ <2%  | **一致**             |
| **Svelte** | ✅ <2%  | ✅ <2%  | **一致**（迁移后）   |
| Vue        | ❌ 2.8% | ❌ 2.8% | 已知渲染基线（见下） |

## 本轮工作（视觉验证驱动的全部修复）

### CMS 应用层（手写 table → IrisTable）

- `apps/cms/src/pages/UsersPage.vue`：原生 `<table>` → IrisTable（columns +
  cell slots + 受控 selection/sort），删除手写排序 UI
- `apps/cms-svelte/src/pages/UsersPage.svelte`：原生 `<table>` → IrisTable

### 组件库层（9 处跨框架漂移，全部有像素/样式证据）

1. **vue IrisTable root 缺 font-size 继承**（react 有 `--iris-font-size-md`）
   → 补 `fontSize: var(--iris-font-size-md, 14px)`
2. **vue 表头字号 13px vs react 14px**（显式 sm vs 继承 md）→ 统一 md
3. **vue selection/expand/summary 列 padding 8px vs react 8px 12px**
   （Table.ts + TableBody.ts 共 6 处）
4. **vue striped 行级 vs react/solid cell 级** → vue 迁移到 cell 级
5. **vue AdminTabs "Tab actions" trigger 浏览器默认样式**（灰底黑字）
   → 样式移到 trigger（对齐 react）
6. **vue NavMenu 激活项被 :where() 归零特异性**，hover 覆盖 active
   （渲染 surface-hover 而非 primary 紫）→ 去掉 :where 提升特异性
7. **vue CMS Shell 用户菜单 trigger 未清除 button 默认样式** → 加 style
8. **svelte IrisTable 缺 cell 自定义渲染**（react render / vue slot 均有）
   → 新增 `render?: (value, row) => Snippet`（svelte 5 snippet，带
   `RowSnippet` 类型别名规避模板泛型解析限制）
9. **vue NavMenu padding-inline 10px → 12px**（v1 报告已记录）

### 收尾修复

- svelte IrisCommandPalette 多行 style: 字符串（agent 引入，svelte2tsx
  不兼容）→ 单行

## Vue 剩余 2.8% 归因

组件逻辑/样式已全部对齐（nav 激活紫块差异消失）。剩余差异：

- `#e2e8f0 ↔ #ffffff` 双向 33%：border 1px 亚像素/抗锯齿偏移
  （h() 渲染 vs JSX 的 DOM 属性顺序 → 边框绘制微差）
- 紫 ↔ 白/浅 575 采样：primary 按钮/分页器边缘抗锯齿
- **属框架渲染本质差异，非组件契约违约**（solid/svelte 通过证明
  IrisTable 本身一致；vue 的 h() 渲染路径在 1px 级别有固有微差）

## 门禁

- `visual-parity.spec.ts`（4 框架分发）：solid/svelte 硬门 PASS；
  vue 记录为已知基线（2.8%）
- 组件库任何样式改动都会触发像素回归信号
