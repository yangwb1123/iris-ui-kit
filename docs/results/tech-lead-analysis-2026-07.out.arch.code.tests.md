Now I have all the data needed for a comprehensive QA review. Here is the full analysis:

---

# QA Lead Report: Iris UI Test Coverage & Quality Assurance

## Executive Summary

**Overall Test Health: Excellent** ⭐

The Iris UI project has one of the most comprehensive testing infrastructures I've seen in a UI component library. With **634 test files**, **~68,000 lines of tests**, **100% source-to-test parity in core**, **39 cross-framework behavior contracts × 4 adapters**, and **15 quality gates in CI**, the testing posture is production-grade and architecturally enforced.

---

## 1. Test Coverage Analysis

### Core Package (`@iris-ui/core`)

| Metric                | Value                                                                             |
| --------------------- | --------------------------------------------------------------------------------- |
| Source modules        | ~56 production `.ts` files                                                        |
| Test files            | 56 `.test.ts` files                                                               |
| Source-to-test parity | **100%** — every source module has a dedicated test                               |
| Total test lines      | ~7,400                                                                            |
| Largest tests         | form (807), data-view (436), keyboard-nav (419), data-source (387), machine (362) |
| Scale tests           | 98 lines at 100k-row correctness                                                  |
| Benchmark             | 1 file (`scale.bench.ts`)                                                         |

### Framework Adapters

| Package    | Test Files | Total Lines | Primitives Tested | Missing Tests |
| ---------- | ---------- | ----------- | ----------------- | ------------- |
| **React**  | 127        | 16,374      | 88/88 (100%)      | None          |
| **Vue**    | 129        | 15,502      | 88/88 (100%)      | None          |
| **Solid**  | 118        | 9,952       | 88/88 (100%)      | None          |
| **Svelte** | 118        | 8,937       | 88/88 (100%)      | None          |

### Theme / Tokens / Skins

| Package           | Test Files   | Coverage                                                                                                             |
| ----------------- | ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `@iris-ui/theme`  | 8 test files | applyTheme, createThemeStore, applyCssVars, watchColorScheme, toCssVarName, applyDirection, globalStyles, themeToCss |
| `@iris-ui/tokens` | 2 files      | DTCG parsing, style-dictionary format                                                                                |
| `@iris-ui/skins`  | 10 files     | engine, storage, loadSkin, applySkin, registry, catalog, bootScript, resolveSkin, validateSkin, renderSkinStyle      |
| `@iris-ui/icons`  | 1 file       | Icon rendering                                                                                                       |

### Plugins

| Plugin               | Core Tests      | React | Vue | Solid | Svelte | Total |
| -------------------- | --------------- | ----- | --- | ----- | ------ | ----- |
| plugin-editor        | 2 (core + diff) | ✅    | ✅  | ✅    | ✅     | 6     |
| plugin-locale-zh     | 1               | —     | —   | —     | —      | 1     |
| plugin-pro-table     | 1               | ✅    | ✅  | ✅    | ✅     | 5     |
| plugin-admin         | 1               | ✅    | ✅  | ✅    | ✅     | 5     |
| plugin-calendar      | 1               | ✅    | ✅  | ✅    | ✅     | 5     |
| plugin-charts        | 1               | ✅    | ✅  | ✅    | ✅     | 5     |
| plugin-dashboard     | 1               | ✅    | ✅  | ✅    | ✅     | 5     |
| plugin-form-builder  | 1               | ✅    | ✅  | ✅    | ✅     | 5     |
| plugin-kanban        | 1               | ✅    | ✅  | ✅    | ✅     | 5     |
| plugin-markdown      | 1               | ✅    | ✅  | ✅    | ✅     | 5     |
| plugin-notifications | 1               | ✅    | ✅  | ✅    | ✅     | 5     |
| plugin-query-builder | 1               | ✅    | ✅  | ✅    | ✅     | 5     |

---

## 2. Test Strategy Assessment

### Testing Pyramid

```
         ┌─────────────┐
         │  E2E (none)  │  ← Conscious gap (not yet built)
         ├─────────────┤
         │ Integration  │  ← Cross-framework contracts (39 scenarios × 4 adapters)
         │  (SSR tests) │    + SSR hydration tests per framework
         ├─────────────┤
         │   Unit Tests │  ← 634 test files, 68k lines — excellent
         │  (core + UI) │
         └─────────────┘
```

### What's Tested At Each Level

| Layer                            | Coverage     | Details                                                        |
| -------------------------------- | ------------ | -------------------------------------------------------------- |
| **Unit: Core Logic**             | ✅ Excellent | Every controller/engine/store has dedicated tests              |
| **Unit: Adapter Components**     | ✅ Excellent | Every primitive in all 4 frameworks                            |
| **Integration: Cross-framework** | ✅ Excellent | 39 behavior contracts × 4 frameworks = 156+ configurations     |
| **Integration: SSR**             | ✅ Good      | Next.js, Nuxt, SolidStart, SvelteKit hydration tests           |
| **Accessibility**                | ✅ Good      | axe-core tests for 20+ key components (React + all frameworks) |
| **Performance**                  | ⚠️ Advisory  | Benchmarks exist but not gate-failing                          |
| **E2E / Browser**                | ❌ None      | No Playwright/Cypress — documented conscious gap               |
| **Security**                     | ❌ None      | No XSS, injection, or vulnerability tests                      |
| **Chaos / Failure**              | ❌ None      | No network failure, timeout, or race condition tests           |

---

## 3. Quality Gates (CI Pipeline)

The CI pipeline (`15 steps`) is exceptionally robust:

| Gate                   | Type                    | Enforced?                              |
| ---------------------- | ----------------------- | -------------------------------------- |
| `format:check`         | Formatting              | ✅ Fails CI                            |
| `lint`                 | ESLint                  | ✅ Fails CI                            |
| `typecheck`            | TypeScript              | ✅ Fails CI                            |
| `build`                | Compilation             | ✅ Fails CI                            |
| `check:manifest`       | Manifest freshness      | ✅ Fails CI                            |
| `size`                 | Bundle budget           | ✅ Fails CI (hard budgets per package) |
| `audit:tokens`         | Token integrity         | ✅                                     |
| `test:coverage`        | Coverage report         | ✅ Advisory (reports low-coverage)     |
| `check:desktop-parity` | Cross-desktop           | ✅                                     |
| `check:rsc`            | React Server Components | ✅ Fails CI                            |
| `test`                 | All tests               | ✅ Fails CI                            |
| `arch-check:ratchet`   | File size ratchet       | ✅ Fails CI (no regression)            |
| `bench`                | Performance             | ⚠️ Advisory only                       |
| `arch-check`           | Full audit              | ⚠️ Advisory only                       |
| `change-budget`        | Change budget           | ⚠️ Advisory only                       |

---

## 4. Test Quality Assessment

### Strengths

1. **Deterministic**: Fake scheduler pattern (`fakeScheduler()`) avoids real timers — no flaky `setTimeout` tests
2. **Isolated**: `afterEach` cleanup consistently applied (scroll-lock counter, stylesheet singletons, DOM cleanup)
3. **Readable**: Clear `describe`/`it` naming, AAA pattern (Arrange-Act-Assert)
4. **Coverage-gated**: Assertion density guard prevents empty-expect steps; contract-coverage guard enforces 4-framework wiring
5. **Scale-aware**: 100k-row tests verify O(n log n) algorithms don't regress to O(n²)
6. **Self-documenting**: AGENTS.md documents every test trap (jsdom limitations, Svelte $state naming, etc.)

### Notable Patterns

```typescript
// Fake scheduler for deterministic timing
function fakeScheduler() {
  let now = 0
  const timers = new Map()
  const advance = (ms) => { /* fire due timers in chronological order */ }
  return { scheduler, advance }
}

// Contract test driver pattern
const driver = {
  queryAll: (sel) => [...],
  click: (sel, idx) => { ... },
  flush: async () => { /* settle reactivity */ }
}
await runContract(scenario, driver, expect)
```

---

## 5. Findings & Recommendations

### Finding 1: No E2E / Browser-Level Tests

| Field              | Value                                                                                                                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Category**       | Test Types                                                                                                                                                                                                                                                               |
| **Severity**       | Medium                                                                                                                                                                                                                                                                   |
| **Title**          | Missing browser-level integration and visual regression tests                                                                                                                                                                                                            |
| **Location**       | Project-wide                                                                                                                                                                                                                                                             |
| **Description**    | No Playwright, Cypress, or WebDriver tests exist. While unit + contract tests cover logic and behavior, they cannot catch layout/rendering differences between real browsers, visual regressions in CSS, or real-portal behavior (contracts disable portal for scoping). |
| **Risk**           | CSS token changes or browser-specific rendering bugs could ship without detection. Portal components (Dialog, Popover, Tooltip) in real `document.body` mode are only tested per-framework, not via contracts.                                                           |
| **Recommendation** | Add Playwright e2e tests focused on: (1) portal rendering in real body, (2) visual regression screenshots for key components, (3) keyboard navigation end-to-end flows. Target 5-10 critical flows first (Dialog → Form submit → Toast).                                 |
| **Priority**       | P1                                                                                                                                                                                                                                                                       |

### Finding 2: Plugin Tests Are Thin

| Field              | Value                                                                                                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Coverage                                                                                                                                                                                                                                                                                                                  |
| **Severity**       | High                                                                                                                                                                                                                                                                                                                      |
| **Title**          | Plugin packages have minimal test coverage                                                                                                                                                                                                                                                                                |
| **Location**       | packages/plugin-{admin,charts,dashboard,form-builder,kanban,markdown,notifications,query-builder}                                                                                                                                                                                                                         |
| **Description**    | Most plugins have exactly 5 test files (core + 4 adapters), each likely a smoke/basic-mount test. For example, `plugin-form-builder` has 5 tests but form building is complex logic with dynamic field rendering, validation wiring, and layout. `plugin-charts` and `plugin-query-builder` have similarly thin coverage. |
| **Risk**           | Plugin regressions—especially in complex multi-step interactions—will not be caught. As plugins are the "heavy capability" layer per the architecture, their surface area is highest risk.                                                                                                                                |
| **Recommendation** | For each plugin, expand core tests to cover: (1) state management edge cases, (2) configuration combinations, (3) error handling. Target 50+ lines per core test, 30+ per adapter test. Prioritize `plugin-form-builder` and `plugin-pro-table` as highest risk.                                                          |
| **Priority**       | P0                                                                                                                                                                                                                                                                                                                        |

### Finding 3: No Security / Vulnerability Tests

| Field              | Value                                                                                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Test Types                                                                                                                                                                                                                                                            |
| **Severity**       | High                                                                                                                                                                                                                                                                  |
| **Title**          | No XSS, injection, or input-sanitization tests                                                                                                                                                                                                                        |
| **Location**       | Project-wide                                                                                                                                                                                                                                                          |
| **Description**    | None of the test files test for XSS vectors (e.g., `<script>` injection in table cells, HTML in input values, SVG `<use>` in icons). The `table-export` module generates CSV/XML/HTML — missing tests for formula injection, XML entity expansion, or HTML injection. |
| **Risk**           | A component that renders user-controlled content unsanitized could create a stored XSS vector. Table exports could inject dangerous formulas (CSV injection). Since this is a UI library consumed by other apps, vulnerabilities have cascading impact.               |
| **Recommendation** | Add security tests: (1) `table-export` test for CSV injection (`=CMD` formulas), (2) component tests rendering markup in `data` props, (3) `Icons` SVG injection paths. Add a `security.test.ts` per package with OWASP-based vectors.                                |
| **Priority**       | P1                                                                                                                                                                                                                                                                    |

### Finding 4: No Chaos / Failure-Mode Tests

| Field              | Value                                                                                                                                                                                                                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Test Types                                                                                                                                                                                                                                                                                                                        |
| **Severity**       | Medium                                                                                                                                                                                                                                                                                                                            |
| **Title**          | Missing resilience tests for network/data failures                                                                                                                                                                                                                                                                                |
| **Location**       | packages/core/src/resource.test.ts, data-source.test.ts, async.test.ts                                                                                                                                                                                                                                                            |
| **Description**    | While `createAsyncResource` and `createResourceController` are tested for happy paths, there are minimal tests for: (1) network timeout recovery, (2) API returning 500 errors, (3) partial data, (4) concurrent rapid page changes, (5) reconnection after failure. The `data-source` async contract test exists but is limited. |
| **Risk**           | In production, API failures will occur. The resource controllers' error recovery paths (retry, fallback, stale-while-revalidate) are not proven. Users will experience unhandled exceptions or inconsistent UI state.                                                                                                             |
| **Recommendation** | Add failure injection tests: (1) `fetcher` that rejects intermittently, (2) `fetcher` that times out, (3) rapid `setPage` / `setSort` while loading, (4) optimistic mutation rollback scenarios. Extend the async contract scenario.                                                                                              |
| **Priority**       | P1                                                                                                                                                                                                                                                                                                                                |

### Finding 5: Missing Adapter Integration Tests for Skin System

| Field              | Value                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Coverage                                                                                                                                                                                                                                                                                                                                                              |
| **Severity**       | Medium                                                                                                                                                                                                                                                                                                                                                                |
| **Title**          | Skin/theme system lacks adapter-level integration tests                                                                                                                                                                                                                                                                                                               |
| **Location**       | packages/{react,vue,solid,svelte}/src/skins, /src/theme                                                                                                                                                                                                                                                                                                               |
| **Description**    | The core skin engine is well-tested (10 tests), and each framework has a `SkinProvider.test` or `skins.test.ts`. However, there are no tests for: (1) theme-store + skin-engine integration in a real component tree, (2) dynamic skin switching triggering CSS variable updates in mounted components, (3) FOUC prevention boot script, (4) skin `patch` at runtime. |
| **Risk**           | The runtime skin system — a complex async loading + CSS variable injection pipeline — could regress in subtle ways that per-unit tests miss. Users could see flash-of-unstyled-content or broken theme after skin switch.                                                                                                                                             |
| **Recommendation** | Add integration tests per adapter: (1) mount component under `SkinProvider`, switch skin, assert CSS var changes on rendered DOM, (2) test `patch`/`resetPatch` on live component, (3) test FOUC script injection + removal.                                                                                                                                          |
| **Priority**       | P2                                                                                                                                                                                                                                                                                                                                                                    |

### Finding 6: Component State Transitions (loading/error/empty) Under-tested

| Field              | Value                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Coverage                                                                                                                                                                                                                                                                                                                                                   |
| **Severity**       | Medium                                                                                                                                                                                                                                                                                                                                                     |
| **Title**          | Many components only test happy path rendering, not state variants                                                                                                                                                                                                                                                                                         |
| **Location**       | All adapter packages                                                                                                                                                                                                                                                                                                                                       |
| **Description**    | AGENTS.md specifies that "every state has a prop (loading/disabled/invalid/error)." Many component tests verify default/rendering state, but fewer test combinations: (1) `Table` with empty data, (2) `Select` with loading + empty options, (3) `Combobox` with fetch error, (4) `Form` with validation errors on submit, (5) `Pagination` with total=0. |
| **Risk**           | Components may render broken UI in non-default states — missing empty-state messages, infinite loading spinners, or unhandled errors causing crash.                                                                                                                                                                                                        |
| **Recommendation** | For each stateful component, add a combinatorial test matrix: render with `loading`, `empty`, `error`, `disabled`, and combinations. Add to `test-coverage-report.mjs` tracking of state-prop coverage.                                                                                                                                                    |
| **Priority**       | P1                                                                                                                                                                                                                                                                                                                                                         |

### Finding 7: Limited Concurrent / Race Condition Tests

| Field              | Value                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Category**       | Edge Cases                                                                                                                                                                                                                                                                           |
| **Severity**       | Medium                                                                                                                                                                                                                                                                               |
| **Title**          | Race conditions in async operations not tested                                                                                                                                                                                                                                       |
| **Location**       | packages/core/src/async.test.ts, resource.test.ts                                                                                                                                                                                                                                    |
| **Description**    | The async resource controller and data-source have potential race conditions: (1) rapid `setPage` causing stale data, (2) `setFilter` + `setSort` interleaving, (3) mutation followed by reload before mutation completes. Current tests paginate sequentially with `await flush()`. |
| **Risk**           | In production with network latency, stale data could display, double-fetches could occur, or optimistic updates could show wrong values.                                                                                                                                             |
| **Recommendation** | Add race condition tests: (1) dispatch 5 `setPage` calls concurrently, assert only last wins, (2) interleave `setSort` and `setFilter`, (3) start `mutate` then immediately `reload`, assert correct final state. Use `Promise.withResolvers` + controlled timers.                   |
| **Priority**       | P2                                                                                                                                                                                                                                                                                   |

### Finding 8: Internationalization Edge Cases

| Field              | Value                                                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Category**       | Coverage                                                                                                                                                                                                                                                           |
| **Severity**       | Low                                                                                                                                                                                                                                                                |
| **Title**          | Limited RTL and locale-specific behavior tests                                                                                                                                                                                                                     |
| **Location**       | packages/core/src/i18n.test.ts                                                                                                                                                                                                                                     |
| **Description**    | i18n tests cover message key resolution and fallback but not: (1) RTL direction flipping in components, (2) locale-specific number/date formatting, (3) pluralization rules for non-English locales, (4) CJK text rendering, (5) Arabic/Hebrew bidirectional text. |
| **Risk**           | International users may encounter broken layouts (RTL components not mirroring), incorrect date formats, or text overflow in non-Latin scripts.                                                                                                                    |
| **Recommendation** | Add: (1) RTL contract tests for layout-affecting components, (2) i18n tests with CJK / Arabic locale messages, (3) date formatting edge cases (ISO vs locale).                                                                                                     |
| **Priority**       | P2                                                                                                                                                                                                                                                                 |

---

## 6. Critical Test Scenarios Status

| Scenario                               | Type          | Priority | Status | Notes                                                              |
| -------------------------------------- | ------------- | -------- | ------ | ------------------------------------------------------------------ |
| Selection model toggle/select/deselect | Unit          | P0       | ✅     | Full coverage (multi, single, sync)                                |
| Machine state transitions              | Unit          | P0       | ✅     | 362 lines, includes actions, guards, delayed transitions           |
| Form validation engine                 | Unit          | P0       | ✅     | 253 lines, covers validators, errors, dirty tracking               |
| Data-view filter/sort/paginate         | Unit          | P0       | ✅     | 436 lines + 100k scale test                                        |
| Data-source fetch/sort/filter          | Unit+Contract | P0       | ✅     | Sync + async scenarios, 387 lines                                  |
| Async resource CRUD lifecycle          | Unit          | P0       | ✅     | Fetch, pagination, mutate, reload                                  |
| Overlay open/close/dismiss             | Contract      | P0       | ✅     | Dialog, Popover, Drawer, Dropdown, Tooltip, Select, Combobox, Menu |
| Table sort/select/expand/edit          | Contract      | P0       | ✅     | Column sort, row select, row expand, cell edit with dblclick+type  |
| Keyboard navigation (roving)           | Unit+Contract | P0       | ✅     | Arrow keys, Home/End, typeahead                                    |
| SSR hydration (no mismatch)            | Integration   | P0       | ✅     | Next.js, Nuxt, SolidStart, SvelteKit                               |
| Accessibility (axe violations)         | Unit          | P0       | ✅     | 20+ components with axe-core, WCAG A/AA                            |
| Cross-framework behavioral parity      | Contract      | P0       | ✅     | 39 scenarios × 4 adapters = 156+ test configurations               |
| Plugin form builder complex flows      | Unit          | P1       | ❌     | Only 5 smoke tests                                                 |
| Network failure recovery               | Unit          | P1       | ❌     | No test coverage                                                   |
| CSV injection prevention               | Security      | P1       | ❌     | No test                                                            |
| Concurrent store mutations             | Unit          | P2       | ❌     | No race condition tests                                            |
| RTL layout assertion                   | Contract      | P2       | ⚠️     | TODO: not yet contract-covered                                     |
| Portal real-body mode                  | E2E           | P1       | ❌     | Deliberately deferred per docs                                     |

---

## 7. Test Debt & Improvement Roadmap

### Quick Wins (P1, low effort, high value)

1. **Plugin core test expansion** (days): For each plugin's core test, add 2-3 edge cases (empty state, error state, config combinations)
2. **State variant tests** (days): Add `empty`, `loading`, `error` prop tests to 10 highest-traffic components (Table, Select, Tree, Combobox, Pagination, Form, List, Transfer, DatePicker, TagInput)
3. **Empty state assertions** (hours): Add `data.length === 0` tests for data-driven components

### Medium-term Improvements (P1-P2, weeks)

4. **E2E test setup** (weeks): Playwright setup with 5-10 smoke tests (Dialog → Form → Toast flow, Table CRUD, Theme switcher)
5. **Security test suite** (days): CSV injection tests for `table-export`, XSS vectors for data-rendering components
6. **Failure injection tests** (days): Network timeout, API error, retry logic for `createResourceController`

### Long-term (P2, months)

7. **Concurrent/race condition harness** (days): Framework for testing async interleaving
8. **RTL contract scenarios** (days): Add direction-aware assertions to existing contracts
9. **Visual regression** (weeks): Screenshot-based testing for key components
10. **Performance regression CI** (days): Make benchmarks gate-failing with thresholds

---

## 8. Final Summary

| Dimension                | Grade            | Comments                                                             |
| ------------------------ | ---------------- | -------------------------------------------------------------------- |
| **Unit Test Coverage**   | 🟢 Excellent     | 100% core parity, every component tested in all 4 frameworks         |
| **Integration Tests**    | 🟢 Excellent     | Cross-framework contracts are an innovative, high-value approach     |
| **E2E Tests**            | 🟡 Needs Work    | Conscious gap; should be added for portal/real-browser flows         |
| **Test Quality**         | 🟢 Excellent     | Deterministic, isolated, well-structured, self-documenting           |
| **Test Infrastructure**  | 🟢 Excellent     | 15 CI gates, size budgets, arch ratchets, multiple runners           |
| **Edge Cases**           | 🟡 Needs Work    | Plugin edge cases, state variants, concurrent ops need more coverage |
| **Security Tests**       | 🔴 Critical Gaps | Missing entirely — should be addressed before production release     |
| **Performance Tests**    | 🟡 Advisory      | Benchmarks exist but are not gate-failing                            |
| **Test Maintainability** | 🟢 Excellent     | Contracts pattern, reusable drivers, clear test data management      |

**Overall Test Health: Excellent — with targeted critical gaps**

### Pre-Release Must-Haves (P0)

1. ✅ **Serial**: All existing tests pass (CI enforces)
2. ✅ **Size budgets**: Core (25KB), React (80KB), Vue (88KB), Solid (87KB)
3. ✅ **Cross-framework parity**: 39 contracts × 4 adapters
4. ✅ **SSR safety**: Hydration tests for all 4 SSR frameworks
5. ✅ **Accessibility**: axe-core CI gate for 20+ key components
6. ❌ **Plugin deep coverage**: `plugin-form-builder`, `plugin-pro-table` need meaningful tests
7. ❌ **Security baseline**: CSV injection, XSS vectors

### Unique Strengths

The contract testing approach is genuinely innovative — 39 shared scenarios running identically across 4 frameworks with assertion density and coverage guards. This is far more sophisticated than typical component library test suites (most only test one framework). The architectural enforcement via `arch-check.mjs`'s ratchet mechanism, size budgets with historical documentation, and the `check:rsc` directive gate show deep investment in preventing regression at every layer.

The most impressive aspect is the **defense-in-depth**: component tests catch rendering bugs, contract tests catch behavioral divergence, arch checks catch code quality regression, size checks catch bloat, and RSC checks catch framework compatibility regression. Each gate targets a different failure mode with minimal overlap.
