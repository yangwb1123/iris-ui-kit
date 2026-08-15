Baseline complete. **`/home/u1/iris-ui/docs/vxe-grid/batch-bl-baseline.md`** (76 lines) — the only file created; `git status` confirms the pre-existing BJ-stage `M` entries untouched, zero source files modified.

## What's in the baseline

**Exact design** (every anchor verified against current code):

- **Prop** — `perfStats?: boolean` at props.ts after the `auditLog` block (:638–653), before `versionHistory` (:657); toolbar gate (:6611–6618) admits it; no handle methods (spec doesn't ask — 克制 fiat).

- **Core** — NEW `perf-stats.ts` (createAuditLog mold 1:1): `PerfSample { durationMs, rows, columns, changes }` + `createPerfStats()` latest-snapshot controller with `latest()/push()/subscribe()/getVersion()`; own subpath `@iris-ui-kit/core/perf-stats` (audit precedent, package.json exports :56–61).

- **Sampling mechanism — the loop-free core** — `perfStartRef` captured at render top (`nowMs()` = `performance.now()` with SSR/jsdom fallback); a **dependency-less `useLayoutEffect`** after every commit pushes `{ durationMs, rows: bodyData.length, columns: leafColumns.length, changes: audit.depth }` into the controller. The push only notifies the panel (separate portal root via `useSyncExternalStore`) — **the table never re-renders from its own measurement** (vs. setState-in-effect which would busy-loop; AuditPanel precedent verbatim). Duration = render+commit layout phase, excludes paint (documented). Off = zero cost.

- **Panel** — NEW `PerfPanel.tsx` (AuditPanel mold): floating + portal, Esc/outside/scroll close, ⚡ trigger `data-iris-perf-trigger` after the history trigger (:7243–7256), 4 stat rows with `-duration/-rows/-columns/-changes` attrs; **dual subscription** (perf + audit) so handle `clearAuditLog()` refreshes changes live; auditLog off → muted `—`.

- **i18n** — +6 keys en (core i18n.ts :142–146) + zh (plugin-locale-zh :80).

**File map**: 4 new files (core controller + test, PerfPanel + test) + 7 edits (core barrel/package.json/i18n, zh locale, props, Table.tsx ×8 touch points, manifest propCount 152→153) + comparison doc 3 sites (iris-only row after :65, 构建状态 :280, test count :338).

**Test plan**: ~9 core (snapshot semantics/subscribe) + ~12 react — the spec-mandatory pair first: 面板渲染 (trigger/gate/open/close/format) and 计数正确 (rows/cols incl. grouped leaves, changes = audit depth, `—` when off), plus live-update-while-open (with a no-feedback-loop regression probe) and clear-via-handle.
