Baseline written to `/home/u1/iris-ui/docs/vxe-grid/batch-dd-baseline.md`.

**What was established** — 单元格数据验证增强 / editRules `regexp` 快捷:

**Core finding**: The built-in `pattern: string | RegExp` rule already lives in `packages/core/src/edit-rules.ts` (`validateRule`, pattern compile + `String(value)` test falling back to `DEFAULT_MESSAGES.pattern`). The batch is a pure **additive shorthand**: a `regexp?: string | RegExp` alias for `pattern`. Since the table's `editRules` is typed `import('@iris-ui-kit/core').EditRule<Row>[]` and every commit path funnels through the core `validateEditRules(Async)`, the change is entirely core-local.

**Exact design**:

1. Add `regexp?: string | RegExp` to `EditRule` (JSDoc'd as built-in pattern shorthand).
2. In `validateRule`, compute `rule.pattern ?? rule.regexp` — `pattern` stays canonical (wins on conflict), `regexp` is the fallback; reuse `DEFAULT_MESSAGES.pattern`; empty values stay exempt, matching pattern semantics.
3. Core 校验 flows through both sync/async APIs with zero extra wiring (validator-stripping already routes to `validateRule`).
4. Tests for regexp added to `edit-rules.test.ts`.

**File map** (zero source-tree diff beyond the two core files):

- `packages/core/src/edit-rules.ts` — field + ~1-line pattern-block change; type re-exported via `index.ts` → flows into `types.ts` automatically.
- `packages/core/src/edit-rules.test.ts` — +3 cases (15 → 18).
- Table.tsx / props.ts / types.ts / styles / i18n / vue2 / vue3 / miniprogram / manifest unchanged (186 props / 32 events zero diff).

**Test plan** (5 cases): regexp RegExp match/reject, regexp string compile + message override, `pattern` precedence, async-API path (real table commit route), default-message fallback.

**Fiats**: `pattern` precedence kept, no flags/global-regexp statefulness added, empty-value exemption preserved, other rules untouched.

No source files modified — `git status` shows only the pre-existing dirt plus the new doc.
