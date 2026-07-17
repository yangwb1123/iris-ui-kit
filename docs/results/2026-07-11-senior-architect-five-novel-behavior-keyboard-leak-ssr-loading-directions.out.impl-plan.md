Now I have a thorough understanding of the codebase. Here is the full Tech Lead analysis.

---

# Tech Lead Analysis: 5 Architecture Gaps in Iris UI

> **Author**: Tech Lead  
> **Date**: 2026-07-12  
> **Context**: Cross-validation of a document identifying 5 architectural gaps. 4/5 assertions are architecturally valid (direction ③ has a detail error, direction ④ has fabricated grep output but a valid core concern).

---

## 1. Task Decomposition

Each task is sized 2-4 hours. Tasks are grouped by direction; dependencies are explicit so parallel execution is clear.

### Direction 1: Behavior Cross-Framework Contract Testing

| Task ID  | Title                                                                 | Files                                                                                                                                                                                                                                                  | Deps               | Hours | Acceptance                                                                                                                                                                                                                                                |
| -------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-001 | Define Behavior contract scenarios in core                            | `packages/core/src/contracts/scenarios/sortable.ts`, `movable.ts`, `resizable.ts`, `hotkey.ts`, `click-outside.ts`, `long-press.ts` + `contracts/index.ts` barrel                                                                                      | None (pure data)   | 3     | 6 `ContractScenario` objects with 8-15 steps each, covering: mount state, interaction sequences, disabled state, unmount cleanup. Each exports a named scenario, registered in `contracts/index.ts` barrel.                                               |
| TASK-002 | Add `pointer` and `type` actions to ContractDriver for Behavior needs | `packages/core/src/contracts/types.ts` (extend `ContractStep.action` union), `runner.ts` (wire new actions)                                                                                                                                            | TASK-001           | 1     | `pointerdown`/`pointerup`/`pointermove` actions added; existing scenarios unchanged.                                                                                                                                                                      |
| TASK-003 | Implement ContractDriver stubs per framework for Behavior scenarios   | React: `packages/react/src/contracts.test.tsx` (add `driver.click` → `pointerDown` chaining for sortable). Vue: `packages/vue/src/contracts.test.ts`. Solid: `packages/solid/src/contracts.test.tsx`. Svelte: `packages/svelte/src/contracts.test.ts`. | TASK-001, TASK-002 | 3     | Each framework's test file imports the 6 new behavior scenarios and runs them (4×6 = 24 test cases). Sortable scenario uses `drag` simulation (pointerDown → pointerMove → pointerUp).                                                                    |
| TASK-004 | Fix sortable contract scenario (DragSim harness)                      | React: create `SortableContractHarness` component in `packages/react/src/contracts.test.tsx` (or new file). Mirror Vue/Solid/Svelte.                                                                                                                   | TASK-001, TASK-003 | 3     | Each framework has a `SortableContractHarness` that renders items with `data-iris-sortable-item` attributes and exposes a `[data-iris-sortable-drag-handle]`. The contract scenario drives pointer-down/pointer-move/pointer-up sequences via the driver. |

**Total Direction 1**: 10 hours

### Direction 2: Keyboard Shortcut Conflict Coordination Protocol

| Task ID  | Title                                        | Files                                                                                                                       | Deps               | Hours | Acceptance                                                                                                                                                                                                                                                           |
| -------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-005 | Define Hotkey coordination core types        | `packages/core/src/hotkey-coordinator.ts` (new)                                                                             | None               | 2     | Exports `HotkeyRegistration` (key+modifiers+handler), `HotkeyPriority` enum (`LOW`/`MEDIUM`/`HIGH`), and `HotkeyCoordinator` interface w/ `register()`, `unregister()`, `getActiveHandler()`. Pure types + one factory (`createHotkeyCoordinator`).                  |
| TASK-006 | Implement HotkeyCoordinator core logic       | `packages/core/src/hotkey-coordinator.ts` (implementation)                                                                  | TASK-005           | 2     | Factory returns object: `register(reg)` returns unsubscribe; coordinator owns a single `keydown` listener on the target; handlers fire in priority order (higher wins); same-priority: last-registered wins; `stopPropagation`-style opt-out by returning `true`.    |
| TASK-007 | Refactor IrisHotkey to use HotkeyCoordinator | 4 frameworks: `packages/{react,vue,solid}/src/behaviors/Hotkey.{tsx,ts}`, `packages/svelte/src/behaviors/IrisHotkey.svelte` | TASK-005, TASK-006 | 3     | All 4 IrisHotkey implementations accept optional `priority` prop (default `LOW`). When multiple IrisHotkey siblings share the same scope, the coordinator picks the highest-priority handler. Backward compatible: existing usage (no `priority`) behaves as before. |
| TASK-008 | Add `scope` coordinator singleton management | `packages/core/src/hotkey-coordinator.ts` (singleton-per-scope), `packages/core/src/index.ts` (re-export)                   | TASK-006           | 1     | `getOrCreateHotkeyCoordinator(scope)` returns a cached coordinator per scope string. Coordinator auto-detaches when last handler unregisters.                                                                                                                        |
| TASK-009 | Hotkey coordinator tests                     | `packages/core/src/hotkey-coordinator.test.ts`                                                                              | TASK-006           | 2     | Unit tests: registration order, priority preemption, unsubscribe cleanup, same-key conflict resolution, `stopPropagation` return value, singleton-per-scope dedup. 95%+ line coverage.                                                                               |

**Total Direction 2**: 10 hours

### Direction 3: Store Subscription Leak Detection & Destroy API Completeness

| Task ID  | Title                                                         | Files                                                                                                     | Deps     | Hours | Acceptance                                                                                                                                                                                                              |
| -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-010 | Add `destroy()` to `createAdminShell`                         | `packages/core/src/admin-shell.ts`                                                                        | None     | 1     | `AdminShell` interface gains `destroy(): void`. Implementation: calls `tabs.store.setState` to clear tabs, resets internal state, allows a flag-based guard so no-op after first call.                                  |
| TASK-011 | Add subscriber leak detection to `createStore`                | `packages/core/src/store.ts`                                                                              | None     | 2     | In dev mode only: `createStore` tracks max subscriber count; emits warning when count exceeds threshold (default 100, configurable). Exposes `store.getSubscriberCount()`. No perf impact in production.                |
| TASK-012 | Add subscriber leak detection to `derived` store              | `packages/core/src/store.ts` (`derived` function)                                                         | TASK-011 | 1     | `derived` dev-mode warning when source-store subscriptions don't drop to zero after all derived listeners detach (leaked source subscription).                                                                          |
| TASK-013 | Document `destroy()` contract in all Store-backed controllers | `packages/core/src/resource.ts`, `admin-shell.ts`, `data-source.ts`, `selection.ts`, and any L4 composite | TASK-010 | 1     | JSDoc on every controller interface stating: "destroy() is idempotent, safe to call after unmount, tears down all subscriptions/aborts in-flight requests".                                                             |
| TASK-014 | Create Store leak integration test                            | `packages/core/src/store-leak.test.ts` (new)                                                              | TASK-011 | 2     | Integration test: create controller, destroy, verify via `getSubscriberCount()` that all subscriptions are released. Covers `createDataSource`, `createResourceController`, `createAdminShell`, `createSelectionModel`. |

**Total Direction 3**: 7 hours

### Direction 4: Plugin Store SSR Safety (Corrected)

| Task ID  | Title                                                          | Files                                                                                | Deps     | Hours | Acceptance                                                                                                                                                                                                                   |
| -------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ | -------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-015 | Audit all plugin `registerStore` calls for SSR safety          | `packages/plugin-*/src/core/index.ts` (all 12 plugins)                               | None     | 1     | Audit report: each `registerStore`/`registerTokens`/`registerMessages` call inspected for `window`/`document`/`localStorage` access. Attached to task as comment.                                                            |
| TASK-016 | Convert `plugin-editor` `registerStore` to `registerLazyStore` | `packages/plugin-editor/src/core/index.ts`                                           | TASK-015 | 1     | `registerStore('editor', …)` → `registerLazyStore('editor', …)`. Store factory now runs on first `usePluginStore('editor')` access, not during `runPlugins`. Add SSR guard in factory (access settings only on client).      |
| TASK-017 | Add SSR smoke test for `runPlugins`                            | `packages/core/src/plugin.test.ts`                                                   | TASK-016 | 2     | New test file with `// @vitest-environment node` that calls `runPlugins` with all 12 plugin install functions; asserts no throws. Mock `window`/`document` as `undefined`.                                                   |
| TASK-018 | Document SSR guidelines for plugin authors                     | `packages/core/src/plugin.ts` (JSDoc on `registerStore`) + `packages/core/README.md` | TASK-015 | 1     | JSDoc on `registerStore` warns: "factory runs eagerly during `runPlugins` — use `registerLazyStore` if factory accesses client-only APIs (`window`, `document`, `localStorage`)." Cross-reference in `createPlugin` example. |

**Total Direction 4**: 5 hours

### Direction 5: Data Loading Semantic State Precision

| Task ID  | Title                                              | Files                                                                                                                                                            | Deps                         | Hours | Acceptance                                                                                                                                                                                                                         |
| -------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------- |
| TASK-019 | Define `LoadingKind` union type                    | `packages/core/src/data-source/types.ts`                                                                                                                         | None                         | 1     | New type: `type LoadingKind = 'initial'                                                                                                                                                                                            | 'refresh' | 'loadmore'`. Add `loadingKind`field to`DataSourceState`. Update `DataSourceController` interface. |
| TASK-020 | Track `loadingKind` in `createDataSource`          | `packages/core/src/data-source.ts`                                                                                                                               | TASK-019                     | 2     | Engine sets `loadingKind` on each load: `'initial'` when `rows.length === 0`, `'refresh'` when paginating/reloading with existing rows, `'loadmore'` on infinite append. Reset to `undefined` on success/error.                    |
| TASK-021 | Add `'refreshing'` to `AsyncStatus`                | `packages/core/src/async.ts`                                                                                                                                     | TASK-019                     | 1     | `AsyncStatus` becomes `'idle'                                                                                                                                                                                                      | 'loading' | 'refreshing'                                                                                      | 'success' | 'error'`. `createAsyncResource`sets`'refreshing'`on reload when prior`data` exists. |
| TASK-022 | Update `resolveDataState` to surface `loadingKind` | `packages/core/src/data-state.ts`                                                                                                                                | TASK-020                     | 1     | Add optional `loadingKind` input to `resolveDataState`. When `loadingKind === 'refresh'` and `hasContent` is true, still returns `'content'` (stale-while-revalidate unchanged). New `loadingKind` field exposed but not breaking. |
| TASK-023 | Update adapters to discriminate loading states     | 4 frameworks: `packages/{react,vue,solid,svelte}/src/primitives/table/` loading indicators, `packages/{react,vue,solid,svelte}/src/data/useDataSource.ts` bridge | TASK-019, TASK-020, TASK-021 | 3     | Table shows subtle refresh indicator (top border shimmer) rather than full-body spinner when `loadingKind === 'refresh'`. Data source hooks expose `loadingKind` in returned state object.                                         |
| TASK-024 | LoadingKind tests                                  | `packages/core/src/data-source.test.ts` (extend), `packages/core/src/async.test.ts` (extend), `packages/core/src/data-state.test.ts` (extend)                    | TASK-019, TASK-020, TASK-021 | 2     | Test that `loadingKind` transitions correctly through load/reload/loadMore cycles. Test that `AsyncStatus` correctly reports `'refreshing'`. Test that contract scenarios still pass unchanged.                                    |

**Total Direction 5**: 10 hours

---

## 2. Execution Order & Parallelism

```mermaid
graph TD
    subgraph "Phase 1 — Foundation (Days 1-2)"
        T001[TASK-001: Behavior scenarios\nin core]
        T005[TASK-005: Hotkey coordinator\ntypes in core]
        T010[TASK-010: Add destroy()\nto createAdminShell]
        T011[TASK-011: Store subscriber\nleak detection]
        T015[TASK-015: Plugin store\nSSR audit]
        T019[TASK-019: LoadingKind\ntype definition]
    end

    subgraph "Phase 2 — Implementation (Days 3-5)"
        T002[TASK-002: Extend ContractDriver\nactions] --> T003[TASK-003: Framework\ncontract stubs]
        T003 --> T004[TASK-004: Sortable\ncontract harness]

        T005 --> T006[TASK-006: HotkeyCoordinator\ncore impl]
        T006 --> T007[TASK-007: Refactor 4×\nIrisHotkey]
        T006 --> T008[TASK-008: Scope coordinator\nsingleton manager]
        T006 --> T009[TASK-009: Coordinator\ntests]

        T010 --> T012[TASK-012: Derived store\nleak detection]
        T011 --> T012
        T010 --> T013[TASK-013: Document\ndestroy() contract]
        T011 --> T014[TASK-014: Store leak\nintegration test]

        T015 --> T016[TASK-016: plugin-editor\n→ registerLazyStore]
        T015 --> T017[TASK-017: SSR smoke\ntest for plugins]
        T015 --> T018[TASK-018: SSR guidelines\ndoc]

        T019 --> T020[TASK-020: Track loadingKind\nin createDataSource]
        T019 --> T021[TASK-021: Add 'refreshing'\nto AsyncStatus]
        T020 --> T022[TASK-022: Update\nresolveDataState]
        T020 --> T023[TASK-023: Adapter\nloading indicators]
        T020 & T021 --> T024[TASK-024: LoadingKind\ntests]
    end

    subgraph "Phase 3 — Verification (Days 6-7)"
        T007 --> T009
        T023 --> T024
        T016 --> T017
        T012 --> T014
    end

    subgraph "Parallel groups"
        P1[Group A: D1\nT001→T002→T003→T004]
        P2[Group B: D2\nT005→T006→T007→T008→T009]
        P3[Group C: D3\nT010→T011→T012→T013→T014]
        P4[Group D: D4\nT015→T016→T017→T018]
        P5[Group E: D5\nT019→T020→T021→T022→T023→T024]
    end
```

### Parallel Execution Groups

| Group | Directions               | Tasks                                                           | Can run alongside            |
| ----- | ------------------------ | --------------------------------------------------------------- | ---------------------------- |
| **A** | D1 (Behavior contracts)  | TASK-001 → TASK-002 → TASK-003 → TASK-004                       | B, C, D, E (all independent) |
| **B** | D2 (Hotkey coordination) | TASK-005 → TASK-006 → TASK-007 → TASK-008 → TASK-009            | A, C, D, E                   |
| **C** | D3 (Store leak)          | TASK-010 → TASK-011 → TASK-012 → TASK-013 → TASK-014            | A, B, D, E                   |
| **D** | D4 (SSR safety)          | TASK-015 → TASK-016 → TASK-017 → TASK-018                       | A, B, C, E                   |
| **E** | D5 (Loading kind)        | TASK-019 → TASK-020 → TASK-021 → TASK-022 → TASK-023 → TASK-024 | A, B, C, D                   |

**Max parallelism**: 5 engineers (one per group). **Minimum critical path**: if 1 engineer, sequential time = 42 hours (~5.5 days at 8h/day). With 5 engineers, wall-clock = ~2.5 days.

---

## 3. Technical Risks

### High Risk

| Risk                                                                                   | Direction | Description                                                                                                                                                                                                                                                                                                                                                                                                       | Mitigation                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sortable contract harness is hard to simulate in jsdom**                             | D1        | jsdom has no layout engine (`getBoundingClientRect` returns `{0,0,0,0}`). Pointer event simulation for sortable drag (pointerDown → N×pointerMove → pointerUp) needs `clientX`/`clientY` that mean nothing to jsdom. The `closestCenter` collision algorithm operates on rects — without real layout, the contract scenario can only verify `activeId`/`overId` at the store level, not visual ghost positioning. | Write the sortable contract scenario to assert **store state** (`data-iris-sortable-dragging`, item `data-state` attr) not pixel positions. For the collision algorithm, add a unit test in core (`sortable.test.ts`) that feeds synthetic rects to `closestCenter` directly. Accept that visual drag-and-drop behavior requires Playwright E2E, not contract tests. |
| **Hotkey coordinator is a singleton; leaks across tests**                              | D2        | `getOrCreateHotkeyCoordinator('document')` returns a module-level singleton. If tests don't properly clean up, registrations cascade across test modules. The coordinator auto-detaches on last unregister, but a test that `vi.fn()` mocks the coordinator could orphan the singleton mock.                                                                                                                      | Use `afterEach` to call `resetAllCoordinators()` (a dev-only export). In production, the singleton is safe because the page lifecycle matches the app lifecycle. In tests, explicitly reset. Mark `resetAllCoordinators` as `@internal`.                                                                                                                             |
| **Shared `store.subscribe` reference counting could miss edge cases**                  | D3        | The `derived` store lazily subscribes/unsubscribes based on listener count. If a subscriber is added and removed synchronously inside a `batch` or during notification, the count can temporarily hit zero and the source subscription drops prematurely, then the next subscribe re-attaches. This is benign functionally but could cause flapping in StrictMode (React double-mount).                           | Add stress test: 50 simultaneous subscribe/unsubscribe cycles inside `batch`. Verify no subscription leak and no stale notification. Consider adding a `holdAlive()` method for consumers that want to pin the derived subscription open (e.g. resource controller that lives across mounts).                                                                        |
| **Backward compatibility of IrisHotkey `priority` prop**                               | D2        | Existing apps that don't pass `priority` get `LOW` (the default). But an app that stacked multiple IrisHotkey instances before now gets coordinator-based arbitration instead of all-firing. For most apps this is a **better** default (no conflict), but if an app relied on multiple handlers firing for the same key, that breaks.                                                                            | Add `allowMultiple: boolean` prop (default `false`). When `true`, the coordinator skips priority arbitration and fires all matching handlers (opt-in to old behavior). Document in migration note.                                                                                                                                                                   |
| **`loadingKind` refactor could break downstream consumers reading `loading` directly** | D5        | The change is purely additive (`loadingKind` + `LoadingKind` type). `loading: boolean` stays. The only risk is if someone pattern-matches on `loading` to decide which UX to show (spinner vs. shimmer) — they'll need to read `loadingKind` to refine. This is a **design intent** (the point of the feature), not a regression.                                                                                 | Add `loadingKind` to the `resolveDataState` input. Document that `loading && loadingKind === 'refresh'` means "show subtle indicator, keep content visible." Update the Table component to use `loadingKind` in its default loading slot.                                                                                                                            |

### Medium Risk

| Risk                                                                         | Direction | Description                                                                                                                                                                                                                                                                                                                       | Mitigation                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Coordinator `keydown` listener ordering**                                  | D2        | The coordinator registers one `keydown` listener per scope. If user code also registers `document.addEventListener('keydown', fn)`, that listener fires AFTER the coordinator. If the coordinator fires the handler and the user's handler also fires, the user gets double execution.                                            | Document: "When using IrisHotkey with the coordinator, do NOT add a separate `document.addEventListener('keydown')` for the same shortcut — the coordinator IS the single listener." The coordinator fires registered handlers in priority order and consumes the event (stops propagation). |
| **Svelte 5 runes compatibility with `createAdminShell` destroy**             | D3        | Svelte 5 `$effect`/`$state` runes interact differently with the `derived` store. Adding `destroy()` to `createAdminShell` requires the Svelte adapter to call it in `onDestroy`. Svelte's `useAdminShell.svelte.ts` uses `toStore` for bridging — must verify the `destroy()` path releases the Svelte reactivity subscription.   | Add a Svelte-specific test: mount `useAdminShell`, trigger navigate, unmount, verify via `tick()` that no state mutations fire after unmount.                                                                                                                                                |
| **`plugin-editor` settings store contains CM6 config — not SSR-safe anyway** | D4        | `createEditorSettingsStore` creates a plain `Store<EditorSettings>`. No DOM access, no `window` — it IS SSR-safe already. But the editor view itself (`createEditor`) accesses `parent.appendChild` which is DOM-only. The store is safe, the editor is not — `registerLazyStore` protects the _pattern_, not this specific case. | Add a JSDoc comment: "The settings store is SSR-safe, but converting to `registerLazyStore` establishes the correct pattern for plugins that DO have SSR-unsafe factories." Add an SSR guard inside `createEditorSettingsStore` as a demonstration.                                          |

---

## 4. Resource Assessment

### Team Composition

| Role                   | Count   | Skills required                                                               | Assigned to                                                                   |
| ---------------------- | ------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Core engineer**      | 1       | TypeScript, state machines, store design, SSR patterns                        | D3 (store leak) + D4 (SSR) + D5 (loading types) — the lowest-level changes    |
| **Contract engineer**  | 1       | Testing infrastructure, ContractDriver patterns, cross-framework test harness | D1 (behavior contracts) — owns the test infra across 4 frameworks             |
| **Framework engineer** | 1       | React/Vue/Solid/Svelte bridge patterns, Behaviors                             | D2 (Hotkey coordinator refactor across 4 frameworks) + adapter changes for D5 |
| **Total**              | **2-3** | —                                                                             | —                                                                             |

### Why 2-3, not 5

- **D4 (SSR safety)** is 1h audit + 2h implementation: a core engineer can do it in half a day alongside D3 work.
- **D5 loading indicators (TASK-023)** requires framework adapter changes — the framework engineer handling D2 can also do this, since D2 is front-loaded (core first, framework later).
- **D1 contract stunts (TASK-003)** is boilerplate: 4 frameworks × copy-paste with minor driver adjustments.

### Key Milestones

| Milestone                         | Deliverable                                                                                                                                     | Date (from start) | Dependencies                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------- |
| **M1: Core types defined**        | All 5 directions have core types/contracts committed: Behavior scenarios, HotkeyCoordinator types, destroy() interfaces, LoadingKind, LazyStore | Day 2 (EOD)       | TASK-001, 005, 010, 015, 019 complete |
| **M2: Core implementations done** | All core logic: HotkeyCoordinator, createAdminShell.destroy(), store leak detection, loadingKind tracking, AsyncStatus.refreshing               | Day 4 (EOD)       | TASK-006, 011, 020, 021 complete      |
| **M3: Framework bridge complete** | All 4 frameworks updated: IrisHotkey with priority, useResourceController destroy, Table loading states, useDataSource bridge extended          | Day 6 (EOD)       | TASK-003, 007, 008, 023 complete      |
| **M4: All tests green**           | 24 new contract scenarios pass + 10+ new unit tests + SSR smoke test + size budgets met                                                         | Day 7 (EOD)       | TASK-004, 009, 014, 017, 024 complete |

### Blockers & Resolutions

| Blocker                                             | Affected                     | Resolution                                                                                                                                                                                                            |
| --------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **jsdom can't simulate real drag-and-drop layouts** | TASK-004 (Sortable contract) | Accept contract scenario tests store-level attrs only, not pixel positions. Add Playwright E2E for visual drag-and-drop as a separate work item.                                                                      |
| **Svelte `$state` variable naming conflicts**       | TASK-007 (Svelte IrisHotkey) | Follow project convention: do not name any `$state` variable `state` (documented in AGENTS.md). Use `hotkeyState` or similar.                                                                                         |
| **VitePress docs for new APIs**                     | All directions               | Each TASK must include JSDoc on exported symbols. Automatic doc extraction via `pnpm gen:manifest` covers the generated `llms.txt`. No separate doc writing task needed unless user-facing docs change significantly. |

---

## 5. Quality Assurance

### Unit Test Coverage

| Area                          | Coverage Target   | Key scenarios                                                                                                                                                         |
| ----------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `createHotkeyCoordinator`     | 95%+              | Registration order, priority preemption, unsubscribe, same-key conflict, `stopPropagation` return value, scope singleton dedup, test isolation (resetAllCoordinators) |
| `createStore` leak detection  | 90%+              | Threshold warning, `getSubscriberCount()`, no-op in production build (skip `process.env` branch), derived store source subscription cleanup                           |
| `createAdminShell.destroy()`  | 100%              | Idempotency, no-op after first call, `tabs` store cleanup, calling destroy while mid-navigate                                                                         |
| `DataSourceState.loadingKind` | 95%+              | Initial→load→success cycle (sets `'initial'`), reload with rows (sets `'refresh'`), loadMore (sets `'loadmore'`), error (resets to `undefined`)                       |
| `AsyncStatus.refreshing`      | 95%+              | `'refreshing'` set on reload when prior data exists, `'loading'` set on first load, `'loading'` set on reload after error (no prior data)                             |
| Behavior contract scenarios   | N/A (integration) | 6 new scenarios × 4 frameworks = 24 integration tests via `runContract`                                                                                               |

### Integration Test Strategy

```
Scenario: All 5 directions work together
  Given: An admin page with:
    - Top-level IrisHotkey("Escape", HIGH) for global dialog close
    - Dialog-internal IrisHotkey("Escape", LOW) for dialog-local close
    - AdminShell with 3 nav items
    - ResourceController for a data table
    - Table with refresh loading state
  When: User presses Escape inside dialog
  Then: Dialog-level handler fires (HIGH priority wins)
  And:  Global handler does NOT fire
  When: User clicks nav item, table reloads
  Then: loadingKind === 'refresh' (rows visible, subtle indicator)
  When: All components unmount
  Then: No subscriptions remain (getSubscriberCount === 0)
```

This integration test should be added to `packages/react/src/` as `behaviors-integration.test.tsx`.

### Contract Scenario Coverage

The 6 new Behavior scenarios should each contain:

| Scenario               | Steps | Key assertions                                                                                                       |
| ---------------------- | ----- | -------------------------------------------------------------------------------------------------------------------- |
| `sortableScenario`     | 12    | Idle state → press → tryStart (threshold gate) → over → moveOver → end → cancel → isActive/isOver                    |
| `movableScenario`      | 8     | Default position → controlled position → drag state `data-state` → disabled cursor → byHandle cursor                 |
| `resizableScenario`    | 10    | 8 handles rendered → controlled size → disabled state → handle subset → minWidth clamp                               |
| `hotkeyScenario`       | 10    | Single shortcut → list of shortcuts → disabled → allowInInputs → input-ignored → scope switching → priority override |
| `clickOutsideScenario` | 8     | Outside click → inside click → ignore list → disabled → portal element (global: true)                                |
| `longPressScenario`    | 6     | Press and hold → quick release (no fire) → holdDelay override → disabled                                             |

### Code Review Checklist

For every PR in this workstream:

- [ ] **Core logic is framework-agnostic**: No `from 'react'` / `from 'vue'` in `packages/core/src/`.
- [ ] **Backward compatible**: No breaking changes to public TypeScript interfaces. Additive fields only.
- [ ] **Destroy is idempotent**: Calling `destroy()` twice is safe. Calling methods after `destroy()` does not throw.
- [ ] **SSR guard**: New core logic does not reference `window`, `document`, `localStorage`, or `navigator` without a guard.
- [ ] **Contract scenarios are complete**: Each new behavior scenario covers the "happy path" + disabled state + unmount cleanup.
- [ ] **All 4 frameworks pass**: CI runs contract tests for React/Vue/Solid/Svelte. No framework-specific divergence.
- [ ] **Size budget**: `pnpm size` does not regress (core +10KB for D3 leak detection is acceptable; D5 adds negligible bytes).
- [ ] **Manifest regenerated**: `pnpm gen:manifest` re-run after adding/removing exports.

### Performance Requirements

| Concern                       | Benchmark                                         | Pass/Fail                                                           |
| ----------------------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| Store leak detection overhead | `createStore` + `setState` 10,000×                | <50ms slower than baseline (dev mode) / zero overhead in production |
| Hotkey coordinator            | 50 registered handlers, one keydown               | <1ms dispatch time (single O(n) scan, n=50)                         |
| loadingKind tracking          | 1,000 table sort operations                       | Zero measurable overhead (one `if` branch in `createDataSource`)    |
| Contract tests                | Full suite (42 + 6 = 48 scenarios × 4 frameworks) | <120s total CI wall time                                            |

---

## 6. Implementation Plan

### Phase 1: Foundation (Days 1-2)

**Goal**: Core types, contracts, and interfaces defined. No framework code yet.

| Day          | Focus                     | Tasks                                                                                                                                                                                              | Owner        |
| ------------ | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| **Day 1 AM** | Core types for D1+D2      | TASK-001: Write 6 behavior contract scenarios as pure TypeScript data objects. TASK-005: Define `HotkeyCoordinator` types + `HotkeyPriority` enum.                                                 | Core eng     |
| **Day 1 PM** | Core types for D3+D4+D5   | TASK-010: Add `destroy()` to `AdminShell` interface. TASK-011: Add `getSubscriberCount()` to `createStore`. TASK-015: Run SSR audit script across 12 plugins. TASK-019: Define `LoadingKind` type. | Core eng     |
| **Day 2 AM** | ContractDriver extensions | TASK-002: Add `pointerdown`/`pointermove`/`pointerup` to ContractStep action union. Wire in runner.                                                                                                | Contract eng |
| **Day 2 PM** | D2 coordinator impl       | TASK-006: Implement `createHotkeyCoordinator` with registration, priority arbitration, singleton-per-scope management. Write tests (TASK-009 scaffold).                                            | Core eng     |

**Verify**: All CI green. Manifest passes. `pnpm build` passes.

### Phase 2: Implementation (Days 3-5)

**Goal**: All core logic and framework bridges implemented. Tests pass in each framework individually.

| Day          | Focus                               | Tasks                                                                                                                                                  | Owner         |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| **Day 3 AM** | D1: Framework contract stubs        | TASK-003: Add 6 Import + `runContract(...)` lines to each framework's `contracts.test.{tsx,ts}`. Create `SortableContractHarness` in React (TASK-004). | Contract eng  |
| **Day 3 PM** | D2: Framework IrisHotkey refactor   | TASK-007: Refactor IrisHotkey in React, Vue, Solid, Svelte to use `HotkeyCoordinator`. Add `priority` prop.                                            | Framework eng |
| **Day 4 AM** | D3: AdminShell destroy + tests      | TASK-012: Add derived store leak detection. TASK-013: Document destroy contract. TASK-014: Write leak integration test.                                | Core eng      |
| **Day 4 PM** | D4: Plugin SSR safety               | TASK-016: Convert `plugin-editor` to `registerLazyStore`. TASK-017: Write SSR smoke test. TASK-018: Document SSR guidelines.                           | Core eng      |
| **Day 5 AM** | D5: Core loadingKind implementation | TASK-020: Track `loadingKind` in `createDataSource`. TASK-021: Add `'refreshing'` to `AsyncStatus`. TASK-022: Update `resolveDataState`.               | Core eng      |
| **Day 5 PM** | D5: Framework loading indicators    | TASK-023: Update Table loading indicator in React, Vue, Solid, Svelte to use `loadingKind`. Update `useDataSource` bridges.                            | Framework eng |

**Verify**: `pnpm turbo run test typecheck lint build` passes for all 4 framework packages + core + plugins.

### Phase 3: Integration & Polish (Days 6-7)

**Goal**: Full-suite test pass, edge cases fixed, documentation complete.

| Day          | Focus                                        | Tasks                                                                                              | Owner                        |
| ------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Day 6 AM** | Hotkey coordinator tests finalized           | TASK-009: Complete all HotkeyCoordinator edge-case tests (priority, conflict, singleton, cleanup). | Core eng                     |
| **Day 6 PM** | LoadingKind tests finalized                  | TASK-024: Write loadingKind transition tests, AsyncStatus refreshing tests, data-state tests.      | Core eng                     |
| **Day 7 AM** | Integration test + cross-framework alignment | Write `behaviors-integration.test.tsx`. Run full suite across all 4 frameworks. Fix divergence.    | Contract eng + Framework eng |
| **Day 7 PM** | PR review, manifest, changelog               | Run `pnpm gen:manifest`. Write changeset entries. Create PRs.                                      | All                          |

**Verify**: Full pipeline green: `pnpm turbo run test typecheck lint build size check:rsc format:check`. 24 new contract scenarios pass across 4 frameworks.

### Total Effort Summary

| Phase                   | Hours    | Wall-clock (2-3 engineers) |
| ----------------------- | -------- | -------------------------- |
| Phase 1: Foundation     | 12h      | 0.5 day                    |
| Phase 2: Implementation | 24h      | 2 days                     |
| Phase 3: Integration    | 9h       | 1 day                      |
| **Total**               | **~45h** | **~3.5 days**              |

---

## Appendix: Evidence Fabrication Handling (Direction 4)

The original document's grep output for direction ④ fabricated 10 out of 11 `registerStore` calls. This is a **credibility issue** that must be addressed in the document review process:

1. **Do not discard the valid technical concern**: The SSR safety argument for `registerStore` eager evaluation is architecturally sound, even though only 1 plugin uses it. The fix (use `registerLazyStore`) is the correct one regardless of grep output veracity.
2. **Institute a verification step in document review**: Any future architecture document with grep/find output must include the raw command output or reference a specific commit hash so reviewers can independently verify.
3. **No change to task scope**: TASK-015 through TASK-018 remain valid. The grep audit (TASK-015) will establish the actual state of affairs, and the `registerStore`→`registerLazyStore` migration (TASK-016) still applies to `plugin-editor`. The SSR smoke test (TASK-017) is equally valuable with 1 or 11 `registerStore` calls.

---

## Decision Checklist for Maintainer

- [ ] Do we accept the **5 directions** as valid architectural improvements?
- [ ] Do we allocate **2-3 engineers** for a **1-week sprint** (42h total)?
- [ ] Do we **defer** visual sortable drag-and-drop E2E tests to a separate Playwright effort? (Recommended)
- [ ] Do we adopt **`registerLazyStore` as the default** for new plugins and deprecate `registerStore` in docs? (Recommended after D4)
- [ ] Do we **backport the `priority` prop** to IrisHotkey or keep it additive-only? (Additive-only recommended)
