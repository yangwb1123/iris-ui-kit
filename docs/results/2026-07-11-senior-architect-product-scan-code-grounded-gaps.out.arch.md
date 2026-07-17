Based on my thorough reading of both scan documents and validation against the actual source code, here is my architecture analysis.

---

# 架构师分析报告 — 代码级 5 方向深度评估

## 1. 架构评估

### 1.1 当前架构的优势

**成功的关注点分离。** 五个方向中有四个直接涉及 core 层（方向②③④⑤），只有一个横跨适配器（方向① Solid Tree）。这印证了「逻辑下沉 core，适配器做薄桥」的设计原则执行良好——core 有能力承载增量复杂性，无需在四个框架间重复实现。

**纯函数层（C 层材料）的复用度高。** `groupRows`、`flattenTree`、`filterSort`、`createMemoizedFilterSort`、`paginate` 等纯函数既存在于 `data-view.ts` 也存在于 `data-view/filter-sort.ts` 和 `data-view/aggregate.ts`，被 data-source、resource、Table 组件、ProTable 插件共五处消费。这说明 C 层材料的定位（「无状态纯函数，A/B 共用」）被严格遵守。

**杠杆效应显著。** 方向④（分组视图控制器）缺失的核心原因是 core 已有 `groupRows` + `flattenTree` + `createExpansion`，但缺少状态化的组合物。填补这一单个缺口将惠及四个框架的 Table/ProTable/Tree 组件，边际收益极高。

### 1.2 关键局限性

| 局限性                   | 体现方向                                                                                                      | 严重程度                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **API 承诺 vs 实现断裂** | 方向① Solid Tree `loadChildren` 声明但未调用                                                                  | **高** — 违反四框架语义对齐核心承诺 |
| **基础设施存在但不连接** | 方向② `createMemoizedFilterSort` 存在但 data-source 未使用；`resource.ts` 中的 `createClientFetcher` 同样缺失 | **中** — 性能悬崖可量化             |
| **类型收缩过早**         | 方向③ `FieldErrors<V>` 定义为 `Partial<Record<Key<V>, string>>`，单字符串类型排斥多错误                       | **低**（类型级修复）但 UX 影响高    |
| **状态化控制器缺失**     | 方向④ 纯函数 + 适配器自行组合 = 每框架重复 800+ 行，核心 gap 在于「展开状态管理 + 扁平化 + 选择感知」未下沉   | **中** — 四框架重复                 |
| **核心抽象不完整**       | 方向⑤ `computeGridVirtualRange` 的 2D 窗口是独立 1D 组合，未引入冻结区域概念                                  | **中** — 延伸至四框架               |

### 1.3 技术债分类

- **Bug（已验证的跨框架 Parity 问题）**：方向① Solid Tree `loadChildren`。类型声明了 API，实现不存在。
- **性能债**：方向② `createClientDataSource` / `createSyncClientDataSource` / `createClientFetcher` 直接调用 `filterSort` 而非 `createMemoizedFilterSort`。`resource.ts:159` 也有相同的模式。
- **UX 债**：方向③ `standardSchemaValidator` 静默丢弃多错误。每次提交只暴露一个错误，用户需反复提交。
- **架构债（四框架重复）**：方向④ 分组视图逻辑未来可能各自实现 → 800+ 行/框架。
- **设计缺口**：方向⑤ 冻结窗格从未进入 core 抽象，每框架自建 sticky 方案。

---

## 2. 扩展方向

### 方向一：跨框架 Parity 自动化门禁（基于方向①的根因防治）

**为什么需要：** Solid Tree `loadChildren` 的缺失不是孤立事件——它是「类型定义存在但实现路径缺失」这类跨框架 parity 问题的代表。一旦出现一个，大概率存在更多。需要系统化的检测机制。

**核心挑战：**

- 跨框架接口的「签名声明」与「实现引用」的匹配检查无法通过 TypeScript 类型系统表达（类型检查通过了，因为接口声明存在而实现只是路径问题）
- 四框架的 barrel 文件结构不同（`tsx`/`ts`/`svelte`），统一扫描需要 AST 级别的分析

**选项评估：**

| 方案                                                                                        | 成本              | 覆盖率   | 精度                       |
| ------------------------------------------------------------------------------------------- | ----------------- | -------- | -------------------------- |
| A. 接口骨架扫描：manifest + AST 提取声明树 vs 实现引用                                      | 中型（~2 天实现） | 组件级   | 高（可检测具体方法缺失）   |
| B. Contract 测试扩增：为每个有 `loadChildren` 声明的组件新增明确的「异步 children」测试场景 | 小型（~1 天）     | 受测组件 | 中（需手动维护测试列表）   |
| C. grep + CI 规则：在 CI 中添加 `grep` 断言，检查声明过的 API 签名在适配器中被引用          | 微型（~2h）       | 声明级   | 低（字符串匹配，易假阳性） |

**推荐方案：A（manifest 骨架扫描）**。manifest 系统已掌握所有组件的导出路径，扩展为扫描每个组件的声明接口（通过 ts-morph 或类似的 AST 工具提取 interface/type 属性）并与四个适配器的实现交叉引用。方向①的 `loadChildren` 可作为首个探测案例。

**预期架构变更：**

- `@iris-ui/manifest` 包新增 `scan:parity` 命令
- 输出 parity gap 报告（JSON 格式，可 CI 断言的）
- 与 `pnpm gen:manifest` 生命周期绑定

**对现有系统的影响：** 零运行时开销，纯开发/CI 工具。manifest 体积略增。

---

### 方向二：数据管线性能层——从引用缓存到语义缓存（基于方向②的深层根治）

**为什么需要：** `createMemoizedFilterSort` 的引用缓存（`===` 比较）对数据源场景无效——因为 data-source 每次 `reload()` 调用时，`query` 对象（包含 `filters[key]=value`）是一个新对象，引用变化导致缓存必 miss。这不是工具使用错误，是缓存策略与调用模式不匹配。

**核心挑战：**

- 核心数据路径（filter → sort → paginate）在每次按键时被完整执行
- 真正的优化应在数据源层做**语义缓存**：比较深相等（deep-equal）的 query，而非引用相等
- 但 deep-equal 本身也有成本（O(query properties)），需量化阈值
- `filterSort` 内部的 `Array.prototype.sort` 是 O(n log n)，对于 10K 行，deep-equal 检查（~20 properties）的 O(1) 开销可忽略

**建议方案：在 `createClientDataSource` 内部使用带 deep-equal 的 memoize 包装器**

```
createClientDataSource 内部
  ↓
  使用 createDeepMemoizedFilterSort（新增，非 createMemoizedFilterSort）
  比较 query 字段的深相等而非引用相等
  或者：将 memoize 从 filterSort 上移到 data-source 层
```

**架构变更：**

- `data-view/filter-sort.ts` 新增 `createDeepMemoizedFilterSort`（或 `ClientDataSourceOptions` 可选参数）
- `data-source/client.ts` 的 `createClientDataSource` / `createSyncClientDataSource` 使用它
- `resource.ts` 的 `createClientFetcher` 同样受益
- 测试：连续调用相同 query 应返回相同引用（通过 `===` 验证）

**权衡：**

| 选项                              | 优势                               | 劣势                                                |
| --------------------------------- | ---------------------------------- | --------------------------------------------------- |
| `createDeepMemoizedFilterSort`    | 简单，单点改动                     | 对于 query 差异微小的场景（「foo」→「fo」）仍需重算 |
| 在 data-source 层做 LRU（~10 条） | 翻页缓存有效；切回之前页面立即命中 | LRU 管理和缓存失效策略复杂化                        |
| 什么都不做（依赖 debounce）       | 零代码变更                         | 每次按键仍是 O(n)，只是减少了触发次数               |

**推荐**：先做 `createDeepMemoizedFilterSort`（30 分钟改动），因为它是 `createMemoizedFilterSort` 的进化版本，没有 debt。LRU 作为 v2 选项。

---

### 方向三：验证错误反馈完整性——从首错即止到多错误收集（基于方向③）

**为什么需要：** `standardSchemaValidator` 的「首错即止」策略直接导致企业表单用户的 UX 退化。每次提交只能看到一个错误，需要「修复→提交→再看下一个→再修复」的循环。对于一个包含密码策略（长度 + 特殊字符 + 大小写 + 数字）和地址验证（省份 + 城市 + 邮编 + 详细地址）的表单，用户可能需要提交 5-6 次才能看到全部错误。

**核心挑战：**

- `FieldErrors<V>` 的类型定义为 `Partial<Record<Key<V>, string>>`，单值约束了 UI 只能展示一个错误。这是类型层面的「第一个错误即选」
- 渲染层（四个框架的 FormField 组件）当前只消费 `string` 错误消息
- 从单值到多值需要：type 升级 + validator 修复 + 渲染端适配

**选项评估：**

| 方案                                                                                           | 变更范围        | 向后兼容              | UX 效果                                  |
| ---------------------------------------------------------------------------------------------- | --------------- | --------------------- | ---------------------------------------- | --------------------------- |
| A. **最小修复**：在 `standardSchemaValidator` 中将多错误拼接为分隔字符串（`"A; B"`），类型不变 | 1 行 + 测试     | ✅ 完全兼容           | 好——用户一次性看到所有错误               |
| B. **类型升级**：`FieldErrors<V>` 改为 `Partial<Record<Key<V>, string                          | string[]>>`     | 类型定义 + 4 框架渲染 | 部分兼容（消费端需适配 `Array.isArray`） | 最好——UI 可单独展示每条错误 |
| C. 激进路线：全面升级为 `FieldErrorItem<V>[]` 结构（带 error code）                            | 大规模 API 变更 | ❌ 破坏性             | 最灵活——错误可分类渲染                   |

**推荐**：先做方案 A（1 行代码，即时发布），方案 B 作为下个迭代的深度改造。方案 C 与核心 form engine 解耦过大，不建议做。

**架构变更（方案 A）：**

- `standard-schema.ts:74`：将 `!(key in errors)` → `errors[key] = errors[key] ? errors[key] + '; ' + issue.message : issue.message`
- 测试：验证两个 `path` 相同的 issue 被拼接
- 适配器端：零变更（`string` 类型不变）

---

### 方向四：状态化的组合控制器层——分组数据视图作为首个消费品（基于方向④）

**为什么需要：** 分组是表格第二大模式（仅次于简单列表）。Iris UI 已拥有 `groupRows`（C 层纯函数）+ `flattenTree`（C 层纯函数）+ `createExpansion`（A 层控制器）+ `createSelectionModel`（A 层控制器），但缺少将它们组合为**状态化分组控制器**的 B 层抽象。每个框架的 Table/ProTable 必须自己管理分组展开状态。

**核心挑战：**

- 分组视图的状态管理复杂：展开/折叠、组排序、组级聚合、组级分页、分组选择感知
- `createExpansion`（键集合并管理）可作为分组展开的存储，但需要适配 key 的映射规则
- 多级分组（`groupBy: [(r) => r.dept, (r) => r.loc]`）需要递归展开状态树

**建议接口设计（不是最终 API，是思路）：**

```
createGroupedView<Row>(config: {
  source: Store<readonly Row[]>    // 观察 data-source 的 rows
  groupBy: GroupKey<Row> | GroupKey<Row>[]  // 单级或多级
  expansion?: ExpansionModel       // 可注入外部展开模型（来自 createExpansion）
  selection?: SelectionModel       // 可注入外部选择模型
  sortGroups?: SortGroupOption     // 'key' | 'size' | ((group) => number)
  initialExpanded?: boolean | ((key) => boolean)
  groupAggregates?: AggregateSpec[]   // 组级小计
}): GroupedViewController<Row>
```

**核心难点：** 分组和选择的关系。分组展开/折叠不应影响选择状态，但全选/取消全选应感知分组边界。需要定义「当展开一个组时，该组内的选中项不再可见，是否应取消选中？」的语义协定。

**预期架构变更：**

- 新增 `packages/core/src/data-view/grouped.ts`（~200-300 行）
- 导出 `createGroupedView` → 返回 `{ store, expandGroup, collapseGroup, toggleGroup, flatten, aggregates }`
- `flatten()` 的输出是 `TreeRow<Row>[]`，兼容 Table 组件的树形行类型
- 测试：400+ 行覆盖展开/折叠/多级/选择/聚合边界

**对现有系统的影响：**

- `createGroupedView` 是纯加法——不修改现有控制器或函数
- Vue/React/Solid/Svelte 的 Table 可逐步消费 `flatten()`，不需一次性全部改造
- ProTable 插件在未来版本中集成组配置（`groupBy` 属性）

---

### 方向五：虚拟化核心的冻结窗格抽象（基于方向⑤）

**为什么需要：** `computeGridVirtualRange` 当前是两个独立 1D 窗口的组合，没有冻结区域的概念。React Table 使用 CSS `position: sticky` 实现列冻结，但这是框架特定方案，且与虚拟化引擎无关。当用户同时需要行冻结 + 列冻结尾窗格时，四框架需要各自实现。

**核心挑战：**

- 冻结区域的双重身份：它们既是「总是可见的」区域，也参与虚拟化布局计算（冻结行的高度影响 body 区域的起始位置）
- 冻结行中的可变高度行使偏移计算复杂化（每个冻结行的高度变化影响 body 窗口的 `offsetBefore`）
- 冻结列 + 水平滚动的同步：冻结列由 `position: sticky` 固定，但滚动条隐藏列时，body 列和冻结列的滚动同步需要 JavaScript 协调

**建议 core 扩展：**

```
computeFrozenGridVirtualRange(options: GridFrozenRangeOptions): FrozenGridWindow
// 返回：
//   top: VirtualWindow           // 冻结行（固定头部）
//   left: VirtualWindow          // 冻结列（固定首列）
//   topLeft: VirtualWindow       // 冻结尾窗格（左上角固定单元格）
//   body: VirtualWindow          // 可滚动主体区域
//   topLeftSize: { width, height }  // 冻结尾窗格的物理尺寸
```

**架构变更：**

- 扩展 `virtual.ts` 的 `GridVirtualRangeOptions` → `freezeRows?: number` / `freezeColumns?: number`
- `computeGridVirtualRange` 内部检测 `freezeRows > 0 || freezeColumns > 0` → 分流到新的冻结算法
- 向后兼容：未设置 freeze 参数时行为不变
- 适配器端：React 可将 `pinnedOffsets` 的 sticky 计算移入 core；Vue/Solid/Svelte 只需调用一次 `computeFrozenGridVirtualRange` 即可获得四象限窗口

**选项评估：**

| 方案                                           | 复杂度                         | 影响                            |
| ---------------------------------------------- | ------------------------------ | ------------------------------- |
| 仅在 core 做数学计算，sticky 留给适配器        | 低（~50 行 core + 测试）       | 解决了大部分抽象缺口            |
| core 输出冻结区域偏移 + 适配器自动 sticky 绑定 | 中（core + 4 适配器各 ~30 行） | 完整的「一个 API 调用实现冻结」 |
| 四框架统一「冻结尾窗格」交互（行列同时冻结）   | 高（~150 行/框架）             | 与 Excel 级功能对齐             |

**推荐**：先做 core 数学计算 + 测试（1 天），适配器逐步集成。React 立即受益（pinnedOffsets 可源自 core），其他框架按需采用。

---

## 3. 接口设计建议

### 3.1 核心接口原则

1. **向后兼容是硬约束。** 五个方向中方向④和⑤是纯加法，方向②和③可以设计为非破坏性优化。方向①是 bug 修复（类型已声明，实现未兑现——严格说是修复而非 API 变更）。任何涉及类型变化的改动（如方向③方案 B 的 `FieldErrors` 升级）必须有 v1→v2 共存期。

2. **核心抽象不可泄露框架细节。** `createGroupedView` 的 store 类型必须是 `Store<GroupedViewState<Row>>`（core 的 `createStore`），而非 React 的 `useState` 或 Vue 的 `ref`。适配器通过 `useGroupedView` 桥接。

3. **组合优先于继承。** 方向④的 `createGroupedView` 应接受可注入的 `expansion` 和 `selection` 实例（由 `createExpansion` / `createSelectionModel` 创建），而非内部创建。这遵循「受控组件优先」模式——使用者可以外部控制展开状态（例如「全部展开」按钮）。

4. **语义明确但不早做类型收缩。** 方向③的 `FieldErrors` 目前定义为单字符串，这个约束太早。设计时值类型应为 `string | string[]`，渲染层在 join/separate 间选择——类型不应替 UI 做决策。

### 3.2 是否需要新的抽象层

**需要引入「组合控制器」层**，位于 C 层纯函数（`groupRows`、`filterSort`）和 A 层控制器（`createExpansion`、`createSelectionModel`）之间。当前项目体系使用「A/B/C 三层」，但方向④揭示了一个 gap：

| 现有层              | 代表                                      | 方向④的对应                          |
| ------------------- | ----------------------------------------- | ------------------------------------ |
| C 层（纯材料）      | `groupRows`, `flattenTree`                | 只做了单次分组/展平，无状态          |
| A 层（核心控制器）  | `createExpansion`, `createSelectionModel` | 管理展开选中的数据结构，但不感知分组 |
| B 层（附加组合）??? | **缺失**                                  | `createGroupedView` 应在这里         |

方向④实际上揭示了 B 层分类的空洞——项目有「A 核心」和「C 纯函数」，但 B 层的「组合这些为状态化控制器」的实例如今没有。`createGroupedView` 应作为 B 层的第一个成员。

**方向⑤** 则相反——它不需要新的抽象层，只需增强现有的 `computeGridVirtualRange` 接口（添加 `freezeRows`/`freezeColumns` 参数）。

### 3.3 向后兼容策略

| 方向                        | 策略                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| ① Solid Tree `loadChildren` | 兼容：仅为实现缺失路径，API 签名不变。使用者已按类型声明写了 `loadChildren` 但等不到结果——修复后结果出现，隐式兼容 |
| ② ClientDataSource memoize  | 兼容：`createClientDataSource` 返回签名不变。唯一变化是连续相同 query 调用返回相同引用（`===`）。测试不会断        |
| ③ Schema validator 多错误   | **A 方案兼容**：`string` → `string;` 分隔字符串输出，类型不变。**B 方案不兼容**：`FieldErrors` 类型变化            |
| ④ 分组视图                  | 纯加法：新导出 `createGroupedView`。零改动现有                                                                     |
| ⑤ 冻结窗格                  | 纯加法：`computeGridVirtualRange` 新参数 `freezeRows`/`freezeColumns`。默认值 0，行为不变                          |

---

## 4. 技术选型

### 4.1 是否需要引入新技术

| 方向           | 技术需求   | 推荐方案                                                                        | 理由                                                                                               |
| -------------- | ---------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| ① Parity 门禁  | AST 分析   | `ts-morph`（开发依赖）                                                          | 轻型，已有 TypeScript 编译器 API，无运行时成本                                                     |
| ② 深层 memoize | deep-equal | 自建 `function deepEqual(a, b): boolean`（~30 行，仅比较 `DataViewQuery` 形状） | 避免引入 `lodash.isequal`（6KB）。我们只需要比较扁平的 `{ filters, sort, multiSort, filterRules }` |
| ③ 多错误收集   | 无         | 纯 JS 字符串操作                                                                | 零依赖                                                                                             |
| ④ 分组控制器   | 无         | 纯 core 逻辑                                                                    | 零依赖                                                                                             |
| ⑤ 冻结窗格     | 无         | 纯 core 数学扩展                                                                | 零依赖                                                                                             |

**结论：不需要引入新框架或重依赖。** 所有五个方向都可以在既有的技术栈（TypeScript + vitest + core 纯函数模式）内解决。

### 4.2 第三方依赖评估标准

对于任何需要引入的外部依赖，使用以下评估矩阵：

| 维度     | 阈值           | 示例（deep-equal 库） |
| -------- | -------------- | --------------------- |
| 包体积   | < 2KB gzip     | 9.5KB → ❌            |
| 替代方案 | 自建 ≤ 50 行   | ✅ 自建 30 行         |
| 框架绑定 | 否             | ✅ 纯 JS              |
| 测试覆盖 | 内部测试可验证 | ✅ 可单元测试         |
| 类型绑定 | 不需要         | ✅                    |

当前五个方向都不需要通过此评估门槛。

### 4.3 自建 vs 采购决策

| 功能         | 自建理由                                                               | 不采购理由                                          |
| ------------ | ---------------------------------------------------------------------- | --------------------------------------------------- |
| Parity 门禁  | 需要深度理解 Iris 的 barrel 和类型结构；通用工具无法检测四框架语义对齐 | 无现成对应产品                                      |
| 深度 memoize | 形状简单（`DataViewQuery` 固定字段），30 行可实现                      | `lodash.isequal` 9.5KB，通用但过重                  |
| 分组控制器   | 需与 `createExpansion`/`createSelectionModel` 深度集成                 | AG Grid 的分组 API 无法适配 Iris 的 controller 模式 |
| 冻结窗格     | 与已有 `computeVirtualRange` 同文同种，数学公式一致                    | 无轻量级虚拟化冻结库可独立使用                      |

---

## 5. 实施路线图

### 优先级矩阵

| 方向                        | 影响面          | 实现成本 | 用户可见性   | 技术债属性 | 优先级         |
| --------------------------- | --------------- | -------- | ------------ | ---------- | -------------- |
| ① Solid Tree `loadChildren` | Solid 适配器    | ~30 行   | 高           | Bug        | **P0（即时）** |
| ③ Schema 多错误             | Core            | 1 行     | 高           | UX 债      | **P0（即时）** |
| ② ClientDataSource memoize  | Core + Resource | 5 行/处  | 中（大数据） | 性能债     | **P1（本周）** |
| ④ 分组控制器                | Core            | ~250 行  | 高（CMS）    | 架构债     | **P2（迭代）** |
| ⑤ 冻结窗格                  | Core + 4 适配器 | ~150 行  | 中           | 设计缺口   | **P2（迭代）** |

### 阶段划分

**阶段 0（Bug 修复 & 即时 UX 改进，<1 天）**

| 任务                                                         | 文件                                              | 行数   | 验证方法                                                    |
| ------------------------------------------------------------ | ------------------------------------------------- | ------ | ----------------------------------------------------------- |
| Solid Tree 添加 `loadChildren` 实现                          | `packages/solid/src/primitives/tree/IrisTree.tsx` | ~30 行 | 编写 `loadChildren` 单元测试 + 集成测试验证展开后子节点渲染 |
| `standardSchemaValidator` 拼接多错误                         | `packages/core/src/standard-schema.ts:74`         | 1 行   | 测试同字段双 Issue → 输出 `"A; B"`                          |
| `createClientDataSource` 使用 `createDeepMemoizedFilterSort` | `packages/core/src/data-source/client.ts`         | ~8 行  | 测试连续相同 query → `===` 引用相等                         |

**里程碑**：`0.1.0-patch.1` 发布。三个即时修复合并后运行 `pnpm turbo run test typecheck lint build` 全绿。

---

**阶段 1（数据层性能增强，~2 天）**

| 任务                                                         | 文件                                         | 复杂度                           |
| ------------------------------------------------------------ | -------------------------------------------- | -------------------------------- |
| 实现 `createDeepMemoizedFilterSort`                          | `packages/core/src/data-view/filter-sort.ts` | 中（deep-equal 实现 + 类型签名） |
| `createClientDataSource` + `createSyncClientDataSource` 消费 | `packages/core/src/data-source/client.ts`    | 小                               |
| `createClientFetcher` 消费                                   | `packages/core/src/resource.ts`              | 小                               |
| 基准测试验证（10K 行，10 次按键场景）                        | `packages/core/src/data-view.bench.ts`       | 小                               |

**关键技术决策**：deep-equal 的实现选择。

```typescript
// 选项 A：手写 DataViewQuery 专用比较器（推荐）
function queryEqual(a: DataViewQuery, b: DataViewQuery): boolean {
  if (a === b) return true
  // 比较 filters 的 keys + values
  // 比较 sort / multiSort
  // 比较 filterRules 长度+每一个
}
// 优势：零依赖，类型安全，O(properties) 最快路径
// 劣势：需要随 DataViewQuery 类型变化而维护

// 选项 B：通用 deep-equal（不推荐）
// 优势：通用
// 劣势：包体积 9.5KB；对 Date/RegExp/Map/Set 的支持不需要
```

**里程碑**：数据管线基准测试 PR 附带性能报告。`pnpm bench` 在 CI 中验证 `filterSort` 调用次数下降。

---

**阶段 2（分组控制器设计 + 实现，~3 天）**

| 子阶段               | 任务                                           | 产出                                     |
| -------------------- | ---------------------------------------------- | ---------------------------------------- |
| 2.1 API 设计         | `createGroupedView` 类型签名 + JSDoc 文档      | 类型设计文档                             |
| 2.2 Core 实现        | 单级分组 + 展开/折叠 + flatten                 | `packages/core/src/data-view/grouped.ts` |
| 2.3 测试             | 展开/折叠状态、选择交互、多级分组、组排序      | 400+ 行测试                              |
| 2.4 ProTable 集成    | 添加 `groupBy` prop → 调用 `createGroupedView` | `packages/plugin-pro-table/`             |
| 2.5 React Table demo | 在 playground 渲染分组表格                     | `apps/playground-react/`                 |

**关键设计决策**——分组选择语义协定：

```
问题：当组 A 被折叠时，用户之前在组 A 选中的项是否仍保持选中？
选项 A：是——选择状态与展开状态正交，选中项始终在 selection set 中
         → 用户对齐：折叠不取消选择
选项 B：否——折叠的组视为「不可见」，不参与选择
         → 用户对齐：折叠=放弃操作（类似文件管理器）
推荐：选项 A，与 createSelectionModel 始终正交——selection 不感知 expansion
```

**里程碑**：`createGroupedView` 在 core 层发布，React playground 有分组表格 demo。四框架 Table 在后续迭代各获取 `groupBy` prop。

---

**阶段 3（虚拟化冻结窗格，~3 天）**

| 子阶段                | 任务                                                     | 产出                                   |
| --------------------- | -------------------------------------------------------- | -------------------------------------- |
| 3.1 Core 数学         | `computeFrozenGridVirtualRange` 实现                     | `packages/core/src/virtual.ts`         |
| 3.2 测试              | 冻结行/冻结列/冻结窗格、可变高度、边界条件               | 300+ 行测试                            |
| 3.3 React 适配        | 将 React Table 的 `pinnedOffsets` sticky 逻辑迁移到 core | `packages/react/src/primitives/table/` |
| 3.4 Vue 适配          | Vue Table 集成（参考 React 迁移路径）                    | `packages/vue/src/primitives/table/`   |
| 3.5 Solid/Svelte 适配 | 初次实现冻结列支持                                       | 各包 table                             |

**技术难点**：

- 冻结行高度可变时，body 区域的 `offsetBefore` 计算需实时读取冻结行的实际大小（尺寸测量函数）——与已有 Fenwick tree / measured-size 缓存策略对齐
- 水平冻结列 + 垂直虚拟机：冻结列的宽度影响 body 列的起始偏移；需要 `startColumnIndex` 补偿 `sticky left` 值

**里程碑**：四个框架的 Table 都有冻结列能力。React 可展示冻结尾窗格（冻结行+列）。基准测试验证冻结区域开销 < 5%。

---

### 风险矩阵

| 风险                                                               | 概率 | 影响 | 缓解策略                                                                                                 |
| ------------------------------------------------------------------ | ---- | ---- | -------------------------------------------------------------------------------------------------------- |
| 方向①修复后 Solid Tree 现有测试失败（如 `isLeaf` 逻辑冲突）        | 中   | 中   | 先读现有测试，`loadChildren` 路径与 `isLeaf` 互斥判断                                                    |
| 方向② deep-equal 导致 `queryEqual` 性能比 `filterSort` 本身还高？  | 低   | 低   | 对 10K 行 `filterSort` 是 O(10K)，`queryEqual` 是 O(20 properties)，算数上必然更轻                       |
| 方向③拼接字符串后渲染端忘记切分                                    | 低   | 中   | `standardSchemaValidator` 的 JSDoc 注释更新为「返回 `"; "` 连接的多错误消息」                            |
| 方向④分组控制器与 `createExpansion` 的选择语义冲突                 | 中   | 高   | 在设计阶段明确协定（建议「选择正交于展开」），用 strict type 强制                                        |
| 方向⑤冻结行高度测量在虚拟化环境中延迟很大                          | 高   | 中   | 对冻结行采用「固定高度（fallback）」+ 可选测量回调模式，避免强制所有冻结行为可变高度                     |
| 四个方向的改动集中在 core，导致 core 体积增长超出预算（当前 10KB） | 中   | 中   | 方向④~250 行 ≈ 4-6KB min; 方向⑤~50 行 ≈ 1KB; 合计 < 7KB 增长，仍在预算内（核心 10KB 只是参考值，需验证） |

---

## 总结

这五个代码级方向诊断出四种不同类型的架构缺口：

| 类型               | 方向 | 根因                                                  | 修复策略               |
| ------------------ | ---- | ----------------------------------------------------- | ---------------------- |
| **接口-实现断裂**  | ①    | 适配器开发时未验证类型声明的每条路径                  | 代码审查 + Parity 门禁 |
| **基础设施未连接** | ②    | data-source 作者不知或忘了 `createMemoizedFilterSort` | 扫码 + 重构            |
| **过早类型收缩**   | ③    | `FieldErrors` 单值类型替 UI 做了决策                  | 类型解明 + 连接方案    |
| **抽象层级空缺**   | ④⑤   | 纯函数与状态控制器之间缺少「组合控制器」层            | 新增 B 层抽象          |

前三者（①-③）是即时可修复的「可见债务」，后两者（④-⑤）是需要经设计评审的「架构投资」。建议本周完成 P0 修复，下个迭代完成 P1，P2 进入正式规划。

对于方向④和⑤，它们指向了同一结论：**Iris UI 的 core 层需要一个「组合控制器」子域**，负责将 C 层纯函数与 A 层控制器组合为可复用的有状态抽象。`createGroupedView` 应是这个子域的第一个市民。方向⑤的 `computeFrozenGridVirtualRange` 可以独立于这个子域存在，因为它是纯数学函数扩展。
