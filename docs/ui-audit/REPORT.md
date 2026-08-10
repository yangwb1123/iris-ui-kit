# iris-ui 设计系统统一化 — 基线审计报告

> **阶段**：设计系统统一化（design-system unification）基线审计 — 只读文档化，
> 未修改任何源码。
> **扫描器**：`iris-ui-spec.py`（ai-batch-runner `projects/iris-ui/scripts/`）
> **模式**：`--mode all`（hex / spacing / shadow / font 四维）
> **数据源**：`docs/ui-audit/report.json`（本次 03:06 重新生成）
> **生成时间**：2026-08-07 03:06 AKDT

## 1. 总览

| 指标         | 值                      |
| ------------ | ----------------------- |
| 扫描文件数   | 1,391                   |
| **违规总数** | **169**                 |
| 退出码       | 1（存在违规，符合预期） |

扫描范围：四个适配器包（react / vue / solid / svelte）+ 插件包
（plugin-kanban / plugin-charts / plugin-pro-table / plugin-calendar /
plugin-dashboard）。跳过目录：`node_modules`、`dist`、`tokens`、`theme`、
`icons`、`color-picker`、测试文件等（token 定义源与颜色本质组件不计入违规）。

> **与上一版报告的关系**：00:38 的旧 REPORT.md 记录 578 违规（font 303 /
> hex 119 / spacing 103 / shadow 53），基于当时的扫描器版本。扫描器脚本在
> 03:04 更新（本仓库 `projects/` 未纳入 git，无历史可对比），本次 03:06
> 以现行脚本重新生成基线：**hex / shadow / font 三维已清零，剩余 169 全部为
> spacing**。本次数字以现行脚本为准。

## 2. 按类别统计

| 类别     | 数量    | 占比 | 含义                                                                                                    |
| -------- | ------- | ---- | ------------------------------------------------------------------------------------------------------- |
| spacing  | 169     | 100% | `padding/margin/gap` 裸像素不在 token 间距刻度（8pt 家族：4/8/12/16/20/24/32/40/48/64；0 仅允许 reset） |
| font     | 0       | 0%   | `fontSize` 裸像素值，未消费 `--iris-font-size-*`                                                        |
| hex      | 0       | 0%   | 裸 hex、`var()` fallback 漂移、未知 token fallback                                                      |
| shadow   | 0       | 0%   | `boxShadow` 硬编码，未消费 `--iris-shadow-*`                                                            |
| **合计** | **169** | 100% |                                                                                                         |

spacing 违规的语法分布与属性分布：

| 维度         | 分布                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------- |
| 语法         | style 对象 155 · CSS 块（svelte/vue `<style>`）9 · 数字型 5                                         |
| 属性         | padding 158 · margin 10 · gap 1                                                                     |
| 典型离刻度值 | 2px（0.125rem）、5px、6px、7px、10px、14px（如 `6px 10px`、`5px 8px 5px 10px`、`2px 6px`、`2px 0`） |

## 3. 按包统计

| 包                          | 违规数  | 占比  |
| --------------------------- | ------- | ----- |
| `packages/solid`            | 55      | 32.5% |
| `packages/react`            | 47      | 27.8% |
| `packages/svelte`           | 29      | 17.2% |
| `packages/vue`              | 19      | 11.2% |
| `packages/plugin-kanban`    | 11      | 6.5%  |
| `packages/plugin-charts`    | 4       | 2.4%  |
| `packages/plugin-pro-table` | 4       | 2.4%  |
| **合计**                    | **169** | 100%  |

四适配器包占 150（88.8%）；solid 与 react 合计 102（60.4%），是主要残留源。
插件包合计 19（11.2%）。

## 4. Top 10 文件（按违规数）

119 个不同文件有违规；第 10 名存在并列（3 个文件同为 3 条），以下列出
11 个 ≥3 条的文件：

| #   | 违规数 | 文件                                                                   |
| --- | ------ | ---------------------------------------------------------------------- |
| 1   | 4      | `packages/react/src/primitives/split-button/SplitButton.tsx`           |
| 1   | 4      | `packages/solid/src/primitives/split-button/IrisSplitButton.tsx`       |
| 1   | 4      | `packages/plugin-kanban/src/react/index.tsx`                           |
| 4   | 3      | `packages/react/src/primitives/combobox/Combobox.tsx`                  |
| 4   | 3      | `packages/react/src/primitives/command-palette/CommandPalette.tsx`     |
| 4   | 3      | `packages/solid/src/primitives/combobox/IrisCombobox.tsx`              |
| 4   | 3      | `packages/solid/src/primitives/command-palette/IrisCommandPalette.tsx` |
| 4   | 3      | `packages/solid/src/primitives/kbd/IrisKbd.tsx`                        |
| 4   | 3      | `packages/svelte/src/primitives/split-button/IrisSplitButton.svelte`   |
| 4   | 3      | `packages/plugin-kanban/src/solid/index.tsx`                           |
| 4   | 3      | `packages/plugin-kanban/src/vue/index.ts`                              |

要点：**split-button 三框架适配器（react/solid/svelte）全部上榜**，是跨包
一致性问题（同一组件三个实现各自残留离刻度间距）；plugin-kanban 的
react/solid/vue 三适配器同样全部上榜。

## 5. 结论与建议

- **当前基线 = 169 条 spacing 违规**，其余三维（font/hex/shadow）合规。
  统一化收尾阶段只需处理 spacing 单一维度。
- 优先队列建议：solid（55）→ react（47）→ svelte（29）→ vue（19）→
  插件（19）。
- 高杠杆目标：split-button 与 kanban 的跨框架适配器组（同一视觉组件在
  各框架重复出现同类值），一次修复同时消除多个包的重复违规。
- 修复方向：把 5px/6px/7px/10px/14px 等离刻度值映射到 8pt 刻度
  （4/8/12/16…），或消费 `--iris-space-*` token；`0.125rem`（=2px）需
  按语义选择 4px 或 0 重置。
- 验收门禁：`python iris-ui-spec.py --mode all --json` 退出码 0。
