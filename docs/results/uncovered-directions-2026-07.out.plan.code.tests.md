Now I have a thorough understanding of the entire implementation. Let me compile my QA review.

---

## QA Lead Review: Direction 1 — Export Unpublished Form Modules

I've conducted a thorough review of the implementation. Here is my complete assessment.

---

## 1. Test Coverage Analysis

| Component                              | Unit Tests | Integration Tests | E2E Tests | Gaps                             |
| -------------------------------------- | ---------- | ----------------- | --------- | -------------------------------- |
| `createValidationEngine`               | ❌ (none)  | ✅ 14 tests       | N/A       | Unit-level mock coverage missing |
| `createStepNavigation`                 | ❌ (none)  | ✅ 14 tests       | N/A       | Unit-level mock coverage missing |
| `createFieldValueOps`                  | ❌ (none)  | ✅ ~12 tests      | N/A       | Mix of integration and unit      |
| `insertItem`                           | ✅ 6 tests | —                 | N/A       | Good                             |
| `removeItem`                           | ✅ 7 tests | —                 | N/A       | Good                             |
| `swapItems`                            | ✅ 5 tests | —                 | N/A       | Good                             |
| `moveItem`                             | ✅ 6 tests | —                 | N/A       | Good                             |
| `insertRemap`                          | ✅ 1 test  | —                 | N/A       | **Minimal coverage**             |
| `removeRemap`                          | ✅ 1 test  | —                 | N/A       | **Minimal coverage**             |
| `swapRemap`                            | ✅ 1 test  | —                 | N/A       | Could be deeper                  |
| `moveRemap`                            | ✅ 3 tests | —                 | N/A       | Adequate                         |
| `rekeyMetadata`                        | ❌         | ✅ 2 tests        | N/A       | **Minimal coverage**             |
| Barrel exports (`form.ts`, `index.ts`) | ❌         | ❌                | N/A       | No import-level contract test    |

**Overall**: 68 new tests across 3 files. Good for a first pass. Several "minimal coverage" areas noted below.

---

## 2. Findings

### Finding 1

| Field              | Value                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Coverage                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Severity**       | High                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Title**          | `rekeyMetadata` is under-tested — only 1 meaningful test case                                                                                                                                                                                                                                                                                                                                                                   |
| **Location**       | `packages/core/src/form/__tests__/field-value-ops.test.ts` — `rekeyMetadata — integration`                                                                                                                                                                                                                                                                                                                                      |
| **Description**    | `rekeyMetadata` is a high-risk function: it mutates 4 metadata maps (errors, touched, dirty, validating) across element-index shifts. Only 2 tests cover it: a single remove-remap scenario and an empty-input case. There is no test for `insertRemap`, `moveRemap`, `swapRemap`, or nested multi-element scenarios. The `rekeyByArrayMutation` helper from `path.ts` is never directly tested through these new tests either. |
| **Risk**           | A bug in `rekeyMetadata` would silently corrupt per-element metadata during array operations (insert/remove/move/swap), causing stale errors/touched/dirty to appear on wrong rows or be lost entirely. This is invisible in unit tests because no form-store-level assertion on metadata correctness is done.                                                                                                                  |
| **Recommendation** | Add tests for ALL four remap types with `rekeyMetadata`: `insertRemap`, `removeRemap`, `swapRemap`, and `moveRemap` (both forward and backward). Each should verify that errors/touched/dirty/validating keys are correctly shifted. Example:                                                                                                                                                                                   |
| **Priority**       | P1 (should have)                                                                                                                                                                                                                                                                                                                                                                                                                |

```typescript
it('rekeyMetadata works with insertRemap', () => {
  const result = rekeyMetadata(
    {
      errors: { 'items[0].name': 'Req' },
      touched: { 'items[0].name': true },
      dirty: { 'items[0].name': false },
      validating: { 'items[0].name': false },
    },
    'items',
    insertRemap(0),
  )
  // items[0] shifts to items[1]
  expect(result.errors).toEqual({ 'items[1].name': 'Req' })
  expect(result.touched).toEqual({ 'items[1].name': true })
})

it('rekeyMetadata works with moveRemap (forward)', () => {
  const result = rekeyMetadata(
    {
      errors: { 'items[0].x': 'E0', 'items[1].x': 'E1', 'items[2].x': 'E2' },
      touched: {},
      dirty: {},
      validating: {},
    },
    'items',
    moveRemap(0, 2),
  )
  // items[0] → 2, items[1] → 0, items[2] → 1
  expect(result.errors).toEqual({ 'items[2].x': 'E0', 'items[0].x': 'E1', 'items[1].x': 'E2' })
})
```

---

### Finding 2

| Field              | Value                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Coverage                                                                                                                                                                                                                                                                                                                                                                |
| **Severity**       | High                                                                                                                                                                                                                                                                                                                                                                    |
| **Title**          | `scheduleValidateWith` has zero test coverage                                                                                                                                                                                                                                                                                                                           |
| **Location**       | `packages/core/src/form/validation.ts` — `scheduleValidateWith` method (line ~126)                                                                                                                                                                                                                                                                                      |
| **Description**    | `scheduleValidateWith` is exposed on the `ValidationEngine` interface and implemented, but never tested. Unlike `scheduleValidate` (which uses the registered `getValues` callback), `scheduleValidateWith` accepts explicit values — a different code path that calls `validateField` directly. If this is an important API for consumers, it needs at least one test. |
| **Risk**           | `scheduleValidateWith` could be broken without detection. If a consumer relies on it (e.g., preview validation from a different state snapshot), they'd silently get no validation or stale errors.                                                                                                                                                                     |
| **Recommendation** | Add 2 tests: one verifying it triggers validation with the explicitly provided values, and one verifying it respects `validateOnChange` false.                                                                                                                                                                                                                          |
| **Priority**       | P1 (should have)                                                                                                                                                                                                                                                                                                                                                        |

```typescript
it('scheduleValidateWith validates with explicit values', async () => {
  const onError = vi.fn()
  const engine = createValidationEngine(
    { x: (v) => (v ? undefined : 'Req') },
    true,
    0,
    { onValidating: () => {}, onError },
    () => ({ x: 'fallback' }), // getValues — should NOT be called
  )
  engine.scheduleValidateWith('x', { x: '' })
  await Promise.resolve()
  expect(onError).toHaveBeenCalledWith('x', 'Req')
})
```

---

### Finding 3

| Field              | Value                                                                                                                                                                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Coverage                                                                                                                                                                                                                                                                                                                                    |
| **Severity**       | Medium                                                                                                                                                                                                                                                                                                                                      |
| **Title**          | `removeRemap` only tested with 1 index — no test for negative edge cases                                                                                                                                                                                                                                                                    |
| **Location**       | `packages/core/src/form/__tests__/field-value-ops.test.ts` — `describe('removeRemap')`                                                                                                                                                                                                                                                      |
| **Description**    | `removeRemap` is a pure function tested with one case (index 2). The function is a closure that handles a special `null` return for the removed index, but there are no tests verifying behavior at index 0 (first element) or negative indices (which should not happen but could in edge cases). The same issue exists for `insertRemap`. |
| **Risk**           | Low, since these are tiny pure functions. But a regression would affect form array operations subtly.                                                                                                                                                                                                                                       |
| **Recommendation** | Add boundary tests for `removeRemap(0)` and `removeRemap(last)`. Also test `insertRemap(0)` and `insertRemap(at-end)`.                                                                                                                                                                                                                      |
| **Priority**       | P2 (nice to have)                                                                                                                                                                                                                                                                                                                           |

---

### Finding 4

| Field              | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Quality                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Severity**       | Medium                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Title**          | Race condition test uses mutable shared variable `resolve1`/`resolve2` — fragile pattern                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Location**       | `packages/core/src/form/__tests__/validation-engine.test.ts` — `'drops a stale async result when a newer validation supersedes it'`                                                                                                                                                                                                                                                                                                                                                                     |
| **Description**    | The test relies on `resolve1` and `resolve2` being assigned in execution order based on the closure inside the validator. The validator function checks `if (!resolve1)` to differentiate calls. This works because both `validateField` calls are synchronously triggered before either resolves, but it depends on closure-assignment order within the same `Promise` constructor. If the implementation changes to defer validator invocation (e.g., a microtask), the assignment order could break. |
| **Risk**           | Low — the test is deterministic with the current implementation, but it's fragile and hard to debug if it breaks. A flaky test in CI would erode trust.                                                                                                                                                                                                                                                                                                                                                 |
| **Recommendation** | Refactor to use explicit sequence control with a deferred promise queue, or use `vi.fn()` returning controlled promises. Example alternative:                                                                                                                                                                                                                                                                                                                                                           |
| **Priority**       | P2 (nice to have)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

```typescript
it('drops a stale async result when a newer validation supersedes it', async () => {
  const onError = vi.fn()
  const resolvers: ((v: string | undefined) => void)[] = []
  const validator = vi.fn().mockImplementation(
    () =>
      new Promise<string | undefined>((r) => {
        resolvers.push(r)
      }),
  )
  const engine = createValidationEngine(
    { name: validator },
    true,
    0,
    { onValidating: () => {}, onError },
    () => ({ name: '' }),
  )
  const p1 = engine.validateField('name', { name: 'a' })
  const p2 = engine.validateField('name', { name: 'b' })
  expect(resolvers).toHaveLength(2)
  resolvers[0]!('Stale error')
  await p1
  expect(onError).not.toHaveBeenCalled()
  resolvers[1]!(undefined)
  await p2
  expect(onError).toHaveBeenCalledTimes(1)
  expect(onError).toHaveBeenCalledWith('name', undefined)
})
```

---

### Finding 5

| Field              | Value                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Strategy                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Severity**       | Medium                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Title**          | No negative/error-path tests for `createStepNavigation` when `validateFields` throws                                                                                                                                                                                                                                                                                                                            |
| **Location**       | `packages/core/src/form/__tests__/step-navigation.test.ts`                                                                                                                                                                                                                                                                                                                                                      |
| **Description**    | `nextStep` and `validateStep` call the injected `validateFields` function, which is `async`. None of the step-navigation tests verify behavior when `validateFields` rejects (throws). The production `createStepNavigation` does not have a `try/catch` around `validateFields` — if it rejects, the error propagates unhandled. This is a real gap: a validation function that throws would break the wizard. |
| **Risk**           | In production, if a validator throws (e.g., accessing a null property), the entire `nextStep()` call rejects. The form store's `validateStep` has similar behavior. The UI would show an unhandled promise rejection, and the user would be stuck.                                                                                                                                                              |
| **Recommendation** | Add a test that validates `validateFields` rejection is handled gracefully (tests should document the current behavior, even if it's a bug). Then consider wrapping `validateFields` in a try/catch.                                                                                                                                                                                                            |
| **Priority**       | P1 (should have)                                                                                                                                                                                                                                                                                                                                                                                                |

```typescript
it('handles validateFields rejection gracefully', async () => {
  const nav = createStepNavigation(
    makeSteps(),
    () => 0,
    () => {},
    async () => {
      throw new Error('Validation crash')
    },
    () => {},
  )
  // Currently this rejects — test documents the behavior
  await expect(nav.nextStep()).rejects.toThrow('Validation crash')
})
```

---

### Finding 6

| Field              | Value                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Coverage                                                                                                                                                                                                                                                                                                                                                             |
| **Severity**       | Low                                                                                                                                                                                                                                                                                                                                                                  |
| **Title**          | `invalidateAll()` has no dedicated test coverage                                                                                                                                                                                                                                                                                                                     |
| **Location**       | `packages/core/src/form/__tests__/validation-engine.test.ts`                                                                                                                                                                                                                                                                                                         |
| **Description**    | `invalidateAll()` clears the token map, meaning subsequent validation results would be treated as stale (since `isCurrent(name)` checks against a cleared token → using fallback `0`). The existing "isCurrent" test calls `invalidateAll()` but the assertion is vague: "the intent is: no validation is in-flight" — it doesn't actually verify expected behavior. |
| **Risk**           | Low — `invalidateAll` is straightforward. But if it were broken, a form reset could leave stale tokens, making validations silently not apply their results.                                                                                                                                                                                                         |
| **Recommendation** | Add a focused test: call `invalidateAll()`, then validate a field, then verify `isCurrent` returns true for the new token.                                                                                                                                                                                                                                           |
| **Priority**       | P2 (nice to have)                                                                                                                                                                                                                                                                                                                                                    |

---

### Finding 7

| Field              | Value                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Infrastructure                                                                                                                                                                                                                                                                                                |
| **Severity**       | Low                                                                                                                                                                                                                                                                                                           |
| **Title**          | No coverage thresholds configured in CI                                                                                                                                                                                                                                                                       |
| **Location**       | Repository root — no `vitest.config.ts`, no coverage tool configured for packages/core                                                                                                                                                                                                                        |
| **Description**    | The `@iris-ui/core` package has no `vitest.config.ts` and no coverage tooling installed. The `test:coverage` task in `turbo.json` exists but is an orphan script (no corresponding `turbo run` for coverage in any pipeline). Coverage cannot be measured, so there is no regression protection for new code. |
| **Risk**           | Without coverage gates, test coverage can silently degrade over time. New modules can be added with 0 tests.                                                                                                                                                                                                  |
| **Recommendation** | Install `@vitest/coverage-v8` in the workspace, add a basic `vitest.config.ts` for `@iris-ui/core` with a `coverage.threshold` (e.g., 80% for the form module), and integrate into the CI pipeline.                                                                                                           |
| **Priority**       | P2 (nice to have)                                                                                                                                                                                                                                                                                             |

---

### Finding 8

| Field              | Value                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Category**       | Test Types                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Severity**       | Medium                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **Title**          | No contract test verifying that standalone modules match form store behavior                                                                                                                                                                                                                                                                                                                                                         |
| **Location**       | `packages/core/src/form/__tests__/` — no cross-validation test                                                                                                                                                                                                                                                                                                                                                                       |
| **Description**    | The implementation report states these are "the same engine used internally by `createFormStore`." However, there is no contract/compliance test that verifies the standalone `createValidationEngine`/`createStepNavigation`/`createFieldValueOps` produce results consistent with the form store's built-in behavior. If the form store's implementation drifts from the standalone modules, or vice versa, there's no safety net. |
| **Risk**           | A future refactor of `createFormStore` that changes internal validation logic could leave the standalone module out of sync. Consumers using the standalone module would get different behavior from consumers using the form store.                                                                                                                                                                                                 |
| **Recommendation** | Add a compliance test that directly compares results from the standalone module vs the form store for identical inputs. Example:                                                                                                                                                                                                                                                                                                     |
| **Priority**       | P1 (should have)                                                                                                                                                                                                                                                                                                                                                                                                                     |

```typescript
it('createValidationEngine matches createFormStore validation behavior', async () => {
  const validator = (v: string) => (v ? undefined : 'Req')
  const standaloneEngine = createValidationEngine(
    { x: validator },
    true,
    0,
    { onValidating: () => {}, onError: () => {} },
    () => form.getState().values,
  )
  const form = createFormStore({
    initialValues: { x: '' },
    validators: { x: validator },
    validateOnChange: false,
  })
  // Compare results
  const standaloneErr = await standaloneEngine.validateField('x', { x: '' })
  form.setFieldValue('x', '')
  await form.validateField('x')
  expect(standaloneErr).toBe(form.getState().errors.x)
})
```

---

### Finding 9

| Field              | Value                                                                                                                                                                                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Category**       | Quality                                                                                                                                                                                                                                                              |
| **Severity**       | Low                                                                                                                                                                                                                                                                  |
| **Title**          | Debounce test uses `vi.useFakeTimers()` without cleaning up on all paths                                                                                                                                                                                             |
| **Location**       | `packages/core/src/form/__tests__/validation-engine.test.ts` — `'debounces validation when debounceMs > 0'`                                                                                                                                                          |
| **Description**    | The test calls `vi.useFakeTimers()` at the start and `vi.useRealTimers()` at the end. If the test fails (e.g., an assertion throws), `vi.useRealTimers()` is never reached, leaving fake timers active for subsequent tests. This can cause cascading test failures. |
| **Risk**           | Low in CI (tests that fail are investigated), but can cause confusing test runner behavior during development — subsequent tests that depend on real timers hang.                                                                                                    |
| **Recommendation** | Wrap in `afterEach` cleanup, or use `it('...', async () => { vi.useFakeTimers(); try { ... } finally { vi.useRealTimers(); } })`. Best practice: use `afterEach(() => { vi.useRealTimers() })` at the describe level.                                                |
| **Priority**       | P2 (nice to have)                                                                                                                                                                                                                                                    |

---

### Finding 10

| Field              | Value                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Category**       | Strategy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Severity**       | Info                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **Title**          | Sub-module `form/` barrel `index.ts` is missing — tests import from `../../form` (the form module entry)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Location**       | All three test files import from `'../../form'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Description**    | The tests import from `../../form` (the form store barrel). This means the tests are testing the re-exported symbols through the main barrel, not directly testing the source modules. This is fine for integration-level tests but means there's no test that verifies the sub-path exports (`@iris-ui/core/form/validation`) work independently. Since the `package.json` `exports` map doesn't include a `"./form/*"` entry, consumers can't import directly from `@iris-ui/core/form/validation` anyway — they must go through the main barrel or a future sub-path export. This is a minor gap in the public API test coverage. |
| **Risk**           | Low — the main barrel is the recommended consumption path. However, if sub-path exports are added later, there's no test that they're correct.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Recommendation** | When sub-path exports are added, add a smoke test that imports from each sub-path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Priority**       | P2 (nice to have)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

---

## 3. Critical Test Scenarios

| Scenario                                                       | Type           | Priority | Current Status                |
| -------------------------------------------------------------- | -------------- | -------- | ----------------------------- |
| Async race condition: slow v1 vs fast v2                       | Integration    | P0       | ✅ Covered                    |
| Race condition: sequential validation (v1 completes, then v2)  | Integration    | P0       | ✅ Covered                    |
| Debounce timing: validation fires after debounce window        | Integration    | P1       | ✅ Covered (with fake timers) |
| `validateOnChange: false` skips debounced validation           | Integration    | P1       | ✅ Covered                    |
| `validateForm` aggregates errors + merges form-level           | Integration    | P1       | ✅ Covered                    |
| `validateForm` handles validator rejection                     | Integration    | P1       | ✅ Covered                    |
| `nextStep` blocks on invalid, advances on valid                | Integration    | P0       | ✅ Covered                    |
| Full wizard flow: next→fail→fix→next→prev→next                 | Integration    | P1       | ✅ Covered                    |
| Step clamping: negative and beyond-max indices                 | Integration    | P1       | ✅ Covered                    |
| `Object.is` semantics for dirty tracking (NaN, +0/-0)          | Unit           | P1       | ✅ Covered                    |
| Array operations (insert/remove/swap/move) boundary conditions | Unit           | P1       | ✅ Covered                    |
| Array operations immutability (original array unchanged)       | Unit           | P0       | ✅ Covered                    |
| `rekeyMetadata` after remove                                   | Integration    | P1       | ✅ One scenario               |
| **`rekeyMetadata` after insert/swap/move**                     | Integration    | P1       | ❌ Missing                    |
| **`scheduleValidateWith` basic validation**                    | Integration    | P2       | ❌ Missing                    |
| **`validateFields` rejection in step navigation**              | Error path     | P1       | ❌ Missing                    |
| **Contract compliance: standalone vs form store**              | Contract       | P1       | ❌ Missing                    |
| **Coverage threshold enforcement**                             | Infrastructure | P2       | ❌ Not configured             |

---

## 4. Final Summary

| Aspect                    | Rating                                                                           |
| ------------------------- | -------------------------------------------------------------------------------- |
| **Overall Test Health**   | **Good** ✅                                                                      |
| **Critical Testing Gaps** | 0 (P0 blockers)                                                                  |
| **High-Severity Gaps**    | 2 (P1 — `rekeyMetadata` coverage, `scheduleValidateWith` coverage)               |
| **Medium-Severity Gaps**  | 3 (P1 — contract compliance, error path handling, fragile race test pattern)     |
| **Low-Severity Gaps**     | 4 (P2 — boundary tests, coverage infra, fake-timer cleanup, rekeyMetadata depth) |

### Summary Assessment

The implementation delivers **68 tests across 3 files** — well-structured, deterministic, and testing the right things. The race-condition test, debounce test, and full wizard flow test demonstrate strong QA thinking. All 809 existing tests continue to pass.

**Strengths:**

- ✅ Race condition test (stale-result protection) is excellent — real async scenario
- ✅ Full wizard flow integration test validates end-to-end multi-step behavior
- ✅ Array operation immutability checks (no mutation of original array)
- ✅ `Object.is` semantics explicitly verified (NaN, +0/-0)
- ✅ Debounce test uses `vi.useFakeTimers` properly (no real waiting)
- ✅ All 4 array operations tested for boundary conditions + null returns
- ✅ `validateForm` tested for aggregation, merge, and exception handling

**Critical Gaps (must address):**

- None at P0 level — the tests are sufficient to prevent regressions in basic functionality.

**Should Address (P1):**

1. **`rekeyMetadata` coverage** — only 1 scenario tested; missing insert/swap/move remap tests
2. **`scheduleValidateWith`** — exposed in interface but zero tests
3. **Error path** — `validateFields` rejection in step navigation not tested
4. **Contract compliance** — standalone modules not cross-validated against form store behavior

**Good to Have (P2):**

1. `removeRemap`/`insertRemap` boundary tests (index 0, last index)
2. `invalidateAll()` dedicated test
3. Fake-timer cleanup with `afterEach`
4. Coverage threshold config in CI

### Recommendation

**Ship direction 1 as-is** — the test suite provides adequate coverage for the core functionality, and the P0/P1 gaps are manageable. Add the `rekeyMetadata` insert/swap/move tests and `scheduleValidateWith` test before declaring the module complete (estimated effort: 30 minutes). The remaining P2 items can be tracked as tech debt.
