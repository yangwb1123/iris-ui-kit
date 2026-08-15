All gates green. Final summary:

## 批 BN 完成报告 — 行高自定义 `rowHeight`（iris 独有）

**Commit**: `a9e88cbd` — `feat(table): grid 批 BN——行高自定义 rowHeight（iris 独有）`（工作树仅剩 runner 的预存 `DECISIONS.md`/`batch-bm-gate.md` M 条目与 baseline 未跟踪文件，均未触碰）

### 实现（全部按 baseline 验证方案，零偏差）

**Prop** — `props.ts` 在 `virtualScroll` 之后、`persistState` 之前：`rowHeight?: number | ((index: number) => number)`（单行函数形，manifest 扫描器卫生达标）

**单一咽喉** `effectiveRowHeight = rowHeight ?? virtualScroll?.itemHeight` 喂三条消费路径：

1. **虚拟路径**（`IrisVirtualScroll itemHeight`）：数字形 → 闭式固定窗口**覆盖默认 itemHeight**；函数形 → 直接作 `estimateSize` 喂 core 虚拟器 **Fenwick offset 树（前缀和）**——批 AG 机制逐字复用，**零 core 改动**
2. **非虚拟路径**（`renderBodyEntry` → 模块级 `rowHeightStyleOf` helper）：数字形 → 行 `extraStyle.height`（格 stretch + flex-center 零格改动）；函数形 → 按 `bodyData` 下标逐行 inline；详情包/组头保持内容高；`rowStyle`（merge 在后）仍是逃生舱
3. **PageUp/PageDown**：±10 步长读同一解析源（函数形取当前行高近似，批 AV 语义）；顺带把局部变量改名 `stepHeight`/`measuredRowHeight` 避免遮蔽新 prop

### 测试（13 新，`row-height.test.tsx` 277 行 ≤500）

规格强制三件套优先：**固定**（非虚拟行 inline height / 虚拟闭式窗口 + `translateY(i*N)` + spacer）· **函数**（非虚拟逐行 `fn(i)` / 虚拟累计 top = 前缀和 + spacer = Σ）· **虚拟组合**（窗口/buffer 边界、深滚动无漂移、**detail 槽 plan 下标陷阱**、rowHeight-wins、itemHeight 回落、PageDown 固定/函数步长）——另加固定+详情包内容高、无 prop 零高 no-op、rowStyle 逃生舱

### 文档

`docs/vxe-grid-comparison.md` 三站点：iris 独有表新行（rowHeight，紧跟 notePopover 行后）· 构建状态行追加批 BN · test count 2219→2232

### 验证（全部 ✅）

| 门                            | 结果                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| core test                     | 1517/1517（零 core 改动）                                                                  |
| react typecheck               | ✅                                                                                         |
| react test                    | **2232/2232**（+13）                                                                       |
| react lint                    | **0 errors**（1 个既有 complexity warn）                                                   |
| spec `--mode all --json`      | **0 violations**                                                                           |
| gen:manifest + check:manifest | ✅ 155 组件、react Table **155 props**（154→155）、`rowHeight` 类型单行提取、llms.txt 同步 |

### 剩余

- vue/solid/svelte 对齐留待后续批（react-only，批范围如此）
- 函数形虚拟模式收 plan 下标（与批 AG `virtualScroll.itemHeight` 同契约，detail 槽交错陷阱已文档化 + 测试锁定）；非虚拟收 body 下标——fiats 已记录
- 批 runner 后置：adapt 报告 + review/gate 阶段
