Gate complete — **FAIL 修复后 PASS → committed**.

## Review verdict: FAIL（单阻塞项 W2 已修，W3 低危按审查接受）

### 修复（W2 阻塞：`format:check` 违反）

`persist-state-harness.svelte`（批 EJ 新增测试 harness）未过 prettier——提交内文件集唯一失败项：

- `columns={columns}` → `{columns}` / `sort={sort}` → `{sort}` / `filters={filters}` → `{filters}` 简写
- `query?: (\n params: unknown,\n) => …` → `query?: (params: unknown) => …` 单行
- 文件缺 EOF 换行

经 `prettier --write` 收口后 `prettier --check` 通过（全仓 `format:check` 零失败）；**仅测试 harness 格式，零行为变更**——19 个测试断言原样通过。W3（filters/columnWidths 恢复多一重 `Array.isArray` 拒绝的失败闭合方向、非受控 sort 经 `applySort` 写内部态、`table-persist.svelte.ts:43` 注释措辞、columnVisibility/columnOrder 恒惰性 = baseline F1）均为非阻塞，按 review 结论「语义与卫生全部通过」接受。

### 全门禁

| 门禁                                                  | 结果                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `turbo run test typecheck lint build --concurrency=2` | ✅ **184/184**（0 cached 全现跑，~5m38s）                                                              |
| `audit:security`                                      | ✅ 0 vulnerabilities                                                                                   |
| `audit:tokens`                                        | ✅ clean（exit 0）                                                                                     |
| `gen:manifest` + `check:manifest`                     | ✅ up to date，nil diff（**155×4 / 86 tokens**；svelte `persistState` **native**、`unavailable` 仍 0） |
| core 零框架 import                                    | ✅ `grep core/src from '(vue\|react\|solid\|svelte)'` 空                                               |
| `format:check`（修复后）                              | ✅ 全仓零失败                                                                                          |

### 最终测试计数（`--force` 现跑）

- **core**: 104 files — **1597/1597**（framework-free，本批零改动）
- **react**: 257 files — **3012/3012** · **vue**: 165 files — **1573/1573** · **solid**: 142 files — **1013 + hydration 38/38** · **svelte**: 146 files — **988 + hydration 35/35 = 1023**（批 EJ `persist-state` **19/19** = jsdom 18 + SSR 1：挂载经回调恢复/整包保存/挂载提交不覆写存储/`storage:false`/坏 JSON/非纯对象/include 双向/自定义 key/pageSize 单请求注入/无回调双向惰性/remoteSort+remoteFilter 重查/惰性块断言）
- lint 0 errors · typecheck ✓

### 提交

- **`<hash>`** — `feat(table): grid 批 EJ——svelte 同步：状态持久化（四框架对齐）`（harness 格式修复 + comparison 批 EJ 行 gate 注 + adapt/review/gate 文档 + DECISIONS 日志，6 files）

⚠️ **Deviation（DV/DW/DX/DY/DZ/EA/EB/EC/ED 先例）**：未跑字面 `git add -A`——并行任务工作树改动（apps/aero-platform-console npm-consumer 化五文件、pnpm-lock.yaml 120 行、Dockerfile/nginx/scripts）原样未动；提交仅含 EJ 批次自身文件。
