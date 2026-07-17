Now I have a thorough code-level understanding of all five directions. Here is the comprehensive Tech Lead analysis.

---

# Tech Lead Analysis: 5 Strategic Architecture Directions for Iris UI

## 1. Task Decomposition

### Direction A: Behavior 下沉 Core

The cross-framework fragmentation in Resizable, ClickOutside, Movable, Hotkey represents real duplication. LongPress and Sortable have already been sunk — proving the pattern works.

**Tasks:**

| ID   | Title                                                            | Files Involved                                       | Deps      | Est. |
| ---- | ---------------------------------------------------------------- | ---------------------------------------------------- | --------- | ---- |
| A-01 | Audit behavior surface & identify core-compatible API            | `packages/{react,vue,solid,svelte}/src/behaviors/`   | ∅         | 3h   |
| A-02 | Sink `createResizable` to core (pointer-agnostic delta machine)  | `packages/core/src/resizable.ts`, test, barrel       | A-01      | 4h   |
| A-03 | Sink `createClickOutside` to core (tree-walk + ignore-refs)      | `packages/core/src/click-outside.ts`, test, barrel   | A-01      | 3h   |
| A-04 | Sink `createMovable` to core (delta machine)                     | `packages/core/src/movable.ts`, test, barrel         | A-01      | 3h   |
| A-05 | Sink `createHotkey` to core (key-pattern matching)               | `packages/core/src/hotkey.ts`, test, barrel          | A-01      | 2h   |
| A-06 | Port React behaviors to consume core controllers                 | `packages/react/src/behaviors/Resizable.tsx` etc.    | A-02–A-05 | 4h   |
| A-07 | Port Vue behaviors to consume core controllers                   | `packages/vue/src/behaviors/Resizable.ts` etc.       | A-02–A-05 | 3h   |
| A-08 | Port Solid behaviors (add missing `ignore` refs on ClickOutside) | `packages/solid/src/behaviors/ClickOutside.tsx` etc. | A-02–A-05 | 3h   |
| A-09 | Port Svelte behaviors to consume core controllers                | `packages/svelte/src/behaviors/`                     | A-02–A-05 | 3h   |
| A-10 | Verify all behavior contracts + cross-framework equivalence      | `packages/*/src/behaviors/*.test.*`                  | A-06–A-09 | 2h   |

**Total: 30h**

### Direction B: 虚拟器调度层

The `createVirtualizer` (371 lines, Fenwick tree) is solid stateless math but has no rAF coalescing, no scheduler injection, and **zero production consumers**. This is a "fix before first consumer" item.

| ID   | Title                                                                 | Files Involved                              | Deps | Est. |
| ---- | --------------------------------------------------------------------- | ------------------------------------------- | ---- | ---- |
| B-01 | Add injectable scheduler interface to virtualizer (rAF/inline/task)   | `packages/core/src/virtualizer.ts`          | ∅    | 3h   |
| B-02 | Add scroll-coalescing via rAF (batch multi-setScroll calls per frame) | `packages/core/src/virtualizer.ts`          | B-01 | 4h   |
| B-03 | Add IntersectionObserver-based viewport detection (optional)          | `packages/core/src/virtualizer.ts`          | B-01 | 3h   |
| B-04 | Add `isScrolling` status signal + `onScrollEnd` callback              | `packages/core/src/virtualizer.ts`          | B-02 | 2h   |
| B-05 | Add benchmark suite for 10k/100k/1M rows                              | `packages/core/src/virtualizer.bench.ts`    | B-02 | 2h   |
| B-06 | Validate no regressions on all four adapter virtual-scroll wrappers   | `packages/*/src/primitives/virtual-scroll/` | B-04 | 2h   |

**Total: 16h**

### Direction C: 复合体焦点层级

The focus trap only supports single-level restore. Multi-tier overlays (dialog over drawer over popover) need a focus stack.

| ID   | Title                                                                   | Files Involved                                                                                  | Deps | Est. |
| ---- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---- | ---- |
| C-01 | Create `FocusStack` controller in core (push/pop/restore/pause)         | `packages/core/src/focus-stack.ts`, test                                                        | ∅    | 4h   |
| C-02 | Define overlay priority hierarchy (Dialog > Drawer > Popover > Tooltip) | `packages/core/src/contracts/overlay-priority.ts`                                               | C-01 | 2h   |
| C-03 | Integrate FocusStack into React `useFocusTrap`                          | `packages/react/src/modal-utils/useFocusTrap.ts`                                                | C-01 | 3h   |
| C-04 | Integrate FocusStack into Vue focus trap                                | `packages/vue/src/primitives/modal-utils/useFocusTrap.ts`                                       | C-01 | 2h   |
| C-05 | Integrate FocusStack into Solid focus trap                              | `packages/solid/src/modal-utils/useFocusTrap.ts`                                                | C-01 | 2h   |
| C-06 | Integrate FocusStack into Svelte focus trap                             | `packages/svelte/src/primitives/modal-utils/useFocusTrap.svelte.ts`                             | C-01 | 2h   |
| C-07 | Add multi-overlay contract test (Dialog→Drawer→Popover focus chain)     | `packages/core/src/contracts/scenarios/overlay-stack-focus.ts`                                  | C-02 | 3h   |
| C-08 | Add zone-level focus protocol for AdminLayout regions                   | `packages/core/src/contracts/scenarios/zone-focus.ts` + `packages/core/src/roving.ts` if needed | C-02 | 4h   |

**Total: 22h**

### Direction D: 跨插件事件总线 + 错误隔离

Plugins today communicate only via `registerStore(key)` + `usePluginStore(key)` — a pull model. Real-world plugins (editor, pro-table, calendar, etc.) need event subscriptions and graceful error isolation.

| ID   | Title                                                              | Files Involved                            | Deps | Est. |
| ---- | ------------------------------------------------------------------ | ----------------------------------------- | ---- | ---- |
| D-01 | Add `PluginEventBus` to core (typed channels + subscribe/emit)     | `packages/core/src/plugin.ts`, test       | ∅    | 4h   |
| D-02 | Wrap `runPlugins` with per-plugin error isolation + rollback       | `packages/core/src/plugin.ts`             | ∅    | 3h   |
| D-03 | Add `registerChannel(channel, handler)` to PluginRegistry          | `packages/core/src/plugin.ts`             | D-01 | 2h   |
| D-04 | Add `usePluginEvent(channel, handler)` to adapter bridges          | `packages/{react,vue,solid,svelte}/src/*` | D-03 | 3h   |
| D-05 | Add cross-plugin event contract tests (plugin A emits, B receives) | `packages/core/src/plugin.test.ts`        | D-03 | 2h   |
| D-06 | Audit existing 12+ plugins for event-bus candidate integrations    | `packages/plugin-*/src/`                  | D-04 | 2h   |

**Total: 16h**

### Direction E: 启动编排器

The 4 desktop OS apps share a pattern (profile → hydrate → restore session → hydrate FS → persist) but implement it differently per framework.

| ID   | Title                                                                  | Files Involved                           | Deps       | Est. |
| ---- | ---------------------------------------------------------------------- | ---------------------------------------- | ---------- | ---- |
| E-01 | Define `AppBootstrap` interface with typed lifecycle hooks             | `packages/core/src/bootstrap.ts`         | ∅          | 3h   |
| E-02 | Implement `createAppBootstrap` with phase sequencing + error isolation | `packages/core/src/bootstrap.ts`, test   | E-01       | 4h   |
| E-03 | Profile hydrate + session restore phase plugin                         | `packages/core/src/bootstrap-session.ts` | E-02       | 3h   |
| E-04 | Virtual FS hydrate + persistence phase plugin                          | `packages/core/src/bootstrap-fs.ts`      | E-02       | 2h   |
| E-05 | Consolidate React desktop-os app to use bootstrap phases               | `apps/desktop-os/src/App.tsx`            | E-03, E-04 | 3h   |
| E-06 | Consolidate Vue desktop-os app                                         | `apps/desktop-os-vue/src/App.vue`        | E-03, E-04 | 2h   |
| E-07 | Consolidate Solid desktop-os app                                       | `apps/desktop-os-solid/src/App.tsx`      | E-03, E-04 | 2h   |
| E-08 | Consolidate Svelte desktop-os app                                      | `apps/desktop-os-svelte/src/App.svelte`  | E-03, E-04 | 2h   |
| E-09 | Verify boot timing in SSR scenario (no DOM, no localStorage)           | `apps/desktop-os/src/App.tsx` SSR mode   | E-05–E-08  | 2h   |

**Total: 23h**

---

## 2. Execution Order & Dependency Graph

```
graph TD
    subgraph "Phase 1: Foundation (Week 1)"
        D01[D-01: PluginEventBus core]
        D02[D-02: runPlugins error isolation]
        C01[C-01: FocusStack core]
        B01[B-01: Scheduler interface]
    end

    subgraph "Phase 2A: Behavior Sinking (Week 2-3)"
        A01[A-01: Audit surface]
        A02[A-02: createResizable]
        A03[A-03: createClickOutside]
        A04[A-04: createMovable]
        A05[A-05: createHotkey]
    end

    subgraph "Phase 2B: Plugin & Focus Full Stack (Week 2-3)"
        D03[D-03: registerChannel] --> D04[D-04: adapter bridges]
        D01 --> D03
        C02[C-02: Overlay priority hierarchy] --> C03[C-03: React focus trap]
        C01 --> C03
        C01 --> C04[C-04: Vue focus trap]
        C01 --> C05[C-05: Solid focus trap]
        C01 --> C06[C-06: Svelte focus trap]
    end

    subgraph "Phase 2C: Virtualizer Scheduling (Week 2-3)"
        B01 --> B02[B-02: rAF coalescing]
        B02 --> B03[B-03: IntersectionObserver]
        B02 --> B04[B-04: isScrolling signal]
    end

    subgraph "Phase 3: Adapter Consolidation (Week 3-4)"
        A02 --> A06[A-06: Port React behaviors]
        A02 --> A07[A-07: Port Vue behaviors]
        A02 --> A08[A-08: Port Solid behaviors]
        A02 --> A09[A-09: Port Svelte behaviors]
        A06 --> A10[A-10: Verify equivalence]
        A07 --> A10
        A08 --> A10
        A09 --> A10
        C03 --> C07[C-07: Multi-overlay contract test]
        C02 --> C08[C-08: Zone focus protocol]
        D04 --> D05[D-05: Cross-plugin event tests]
        D04 --> D06[D-06: Audit existing plugins]
    end

    subgraph "Phase 4: Startup Orchestrator (Week 4-5)"
        E01[E-01: AppBootstrap interface] --> E02[E-02: createAppBootstrap]
        E02 --> E03[E-03: Session phase plugin]
        E02 --> E04[E-04: FS phase plugin]
        E03 --> E05[E-05: React desktop-os]
        E03 --> E06[E-06: Vue desktop-os]
        E03 --> E07[E-07: Solid desktop-os]
        E03 --> E08[E-08: Svelte desktop-os]
        E05 --> E09[E-09: SSR verification]
    end

    subgraph "Phase 5: Bench & Polish (Week 5-6)"
        B04 --> B05[B-05: 1M-row benchmark]
        B05 --> B06[B-06: Adapter virtual-scroll validation]
    end

    D01 -.-> D02
    style D01 fill:#e1f5fe
    style C01 fill:#e1f5fe
    style B01 fill:#e1f5fe
    style A01 fill:#f3e5f5
    style E01 fill:#fff3e0
```

### Parallel Groups

These groups can be worked on concurrently by different developers:

| Group              | Tasks                  | Developer Type |
| ------------------ | ---------------------- | -------------- |
| **G1: Foundation** | D-01, D-02, C-01, B-01 | Core architect |
| **G2: Behaviors**  | A-01 through A-05      | Full-stack dev |
| **G3: Desktop OS** | E-01, E-02             | Full-stack dev |

After G1 completes:

- G1a: D-03, D-04, D-05 | Plugin specialist
- G1b: C-02 through C-06 | Accessibility specialist
- G1c: B-02, B-03, B-04 | Performance engineer

---

## 3. Technical Risks

### 🟠 Risk 1 — Behavior Sinking: Pointer Abstraction Mismatch

**Problem:** React/Vue already have `useDrag` as an internal primitive; Solid uses raw `onMouseDown`; Svelte uses raw `onmousedown`. A core `createResizable` must work with **any** pointer mechanism — but the delta math is the same.

**Mitigation:** Design the core controller to accept `dx`/`dy` deltas (not mouse events). The adapter converts whatever pointer mechanism it has into `(dx, dy, pointerId)` — already proven by `createSortable` which takes `SortablePoint` objects. Do NOT create a core pointer abstraction; keep it delta-based.

### 🟠 Risk 2 — Focus Stack: Nested Overlay Unmount Timing

**Problem:** When a dialog is closed, the focus trap deactivates and restores focus. But if a drawer is underneath and its trap also deactivates on close — who restores first? The `useEffect` cleanup order depends on component tree depth, which varies per framework.

**Mitigation:** The `FocusStack` controller operates on explicit push/pop (not DOM introspection). Each overlay calls `focusStack.push(container, returnTo)` on open and `focusStack.pop()` on close. The stack always restores the **previous** entry, not the document-active-element — eliminating dependency on cleanup order. This is a pure logic controller; the adapter just calls push/pop at the right lifecycle points.

### 🔴 Risk 3 — Virtualizer: No Production Data

**Problem:** The virtualizer has zero production consumers today. Without a real dataset and layout, it is impossible to validate that:

- rAF coalescing doesn't cause visible lag
- The Fenwick tree overhead (~371 lines) is worth it vs. `computeVirtualRange` (pure math)
- `scrollToIndex` alignment works with variable-height content at scale

**Mitigation:**

1. Build the benchmark suite (B-05) **before** the scheduling layer to establish a baseline
2. Add a `createVirtualizer` usage to one of the demo apps (e.g., CMS list or a large file list in desktop-os) — even if synthetic data — as a "integration canary"
3. If the Fenwick tree proves over-engineered for typical row counts (≤10k), add a fast-path that delegates to the O(n) `computeVirtualRange` for small lists and the Fenwick tree only for large ones

### 🟡 Risk 4 — Event Bus: Plugin Ordering + Memory Leaks

**Problem:** The existing `runPlugins` uses topological sort. Adding event channels introduces **implicit ordering dependencies** (plugin A subscribes before plugin B emits). If a plugin emits during its own `install`, no other plugin has subscribed yet.

**Mitigation:**

- All channel subscriptions installed during `install` are deferred until **after** all plugins have installed (phase separation: install → connect → emit)
- The event bus exposes `deferPublish()` — messages sent before `connect` phase are buffered and replayed
- Clear lifecycle: `install` → `connect` (channels active) → `running` (normal emit)
- Each `subscribe` returns an unsubscribe function that is automatically collected into `onTeardown` — no manual cleanup

### 🟡 Risk 5 — Cross-Framework Behavioral Equivalence

**Problem:** Solid's ClickOutside lacks `ignore` refs; React's ClickOutside walks the parent chain; Vue's uses `watchEffect`. After sinking to core, the four adapters must produce **identical** behavior — but each framework's reactivity model differs.

**Mitigation:**

- The core `createClickOutside({ onOutside, ignoreElements })` returns a reactive object with `attach(container)` / `detach()` — the adapter just calls `attach`/`detach` at the right lifecycle points
- The contract test suite (`packages/core/src/contracts/scenarios/click-outside.ts`) already defines the expected behavior; each adapter's test imports the same scenario
- Add a cross-framework "behavior equivalence" CI step that runs the same scenario HTML-in-a-box test against all four framework bundles

---

## 4. Resource Assessment

### Team Composition

| Role                      | Count      | Covers                                                                                |
| ------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| **Core architect**        | 1          | All core abstractions (focus stack, event bus, virtualizer scheduling, app bootstrap) |
| **Framework specialist**  | 2 (shared) | Porting behaviors to 4 frameworks; focus trap integration on 4 frameworks             |
| **Full-stack / Demo dev** | 1          | Desktop OS app consolidation; benchmark harness; integration canary                   |
| **QA / A11y specialist**  | 1          | Contract tests; cross-framework equivalence; focus-trap verification; axe/SSR         |

The work is structured such that the core architect can work independently on foundation tasks (Phase 1), enabling the framework specialists and demo dev to consume those foundations in Phases 2-3.

### Timeline

```
Week  1: ████████  Phase 1 — Foundation (core architect 1.0FTE, 2 framework devs 0.5FTE each)
                   Core architect: D-01, D-02, C-01, B-01
                   Framework devs: A-01 (audit, shared), begin A-02 through A-05
                   Full-stack dev: E-01

Week  2: ████████  Phase 2A+2C — Behaviors core + Virtualizer scheduling
                   Core architect: D-03, B-02, B-03
                   Framework devs: A-06, A-07 (port React + Vue)
                   Full-stack dev: B-04, B-05

Week  3: ████████  Phase 2B+3 — Plugin full stack + Focus trap integration
                   Core architect: C-02, C-07, C-08
                   Framework devs: A-08, A-09 (port Solid + Svelte), C-03–C-06
                   Full-stack dev: D-04, D-05, E-02

Week  4: ████████  Phase 3 cont'd + Phase 4 — Remaining ports + Startup orchestrator
                   Core architect: D-06, E-03, E-04
                   Framework devs: A-10, C-07 test passes
                   Full-stack dev: E-05, E-06

Week  5: ████████  Phase 4+5 — Desktop OS consolidation + Bench + Polish
                   Core architect: C-08, review
                   Framework devs: E-07, E-08, E-09
                   Full-stack dev: B-06, finalize benchmark
                   QA: Full cross-framework contract run, axe verification
```

### Blockers & Resolutions

| Blocker                                                                                              | Impact                                      | Resolution                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| No consumer for virtualizer means undefined perf requirements                                        | B-05 is aspirational without a real dataset | **Short-term:** Add a synthetic 100k-row list to the playground app. **Long-term:** Capture the CMS app's real table sizes and use them as the benchmark baseline. |
| Svelte 5 `$state` + `generics` limitation (AGENTS.md warning) could complicate behavior sinking      | Svelte port may need workarounds            | Follow existing pattern: use `$state<T>()` with explicit types, avoid naming variables `state`. If rune recognition breaks, fall back to store-based reactivity.   |
| Plugin ecosystem is still nascent (12+ plugins but few real-world cross-plugin chains)               | Event bus may be premature abstraction      | Build the event bus interface but defer D-06 (audit existing plugins) until a concrete cross-plugin need emerges. Prioritize error isolation (D-02) over channels. |
| Contract tests depend on jsdom; intra-overlay focus stacking may not be testable without real layout | C-07 may need Playwright/e2e                | Use Playwright for multi-overlay focus stack tests. The contract definitions live in core but the test runner for multi-layer scenarios is browser-only.           |

---

## 5. Quality Assurance

### Unit Test Coverage Requirements

| Module                | Coverage Target | Key Edge Cases                                                                                                               |
| --------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `focus-stack.ts`      | 100% branches   | Empty stack pop, duplicate push, pause/resume, async deactivation, element removed while stacked                             |
| `plugin-event-bus.ts` | 100% branches   | Sub before emit, emit before sub (deferred), multiple channels, unsubscribe during emit, error in handler does not propagate |
| `resizable.ts`        | 95%+            | All 8 handles, aspect ratio lock, min/max clamping, both axes, disabled, zero-size, rtl direction                            |
| `click-outside.ts`    | 95%+            | Multiple ignore refs, nested wrappers, disabled toggle, detached target, pointerdown on scrolled-out element                 |
| `movable.ts`          | 95%+            | Boundaries, snap-to-grid, disabled during drag, nested movable                                                               |
| `hotkey.ts`           | 95%+            | Case sensitivity, modifier combos, conflicting hotkeys, disabled, target element vs document                                 |
| `virtualizer.ts`      | 90%+            | Scroll jump while rAF pending, viewport resize mid-scroll, sparse measurements, 0-count, all estimates wrong                 |
| `bootstrap.ts`        | 100% branches   | Phase failure isolation, re-entrance guard, SSR (no DOM), phase timeout, parallel vs sequential phases                       |

### Integration Test Strategy

The existing contract-scenario architecture (`packages/core/src/contracts/scenarios/`) is the right vehicle. Each direction adds scenarios:

| Direction | New Contract Scenarios                                                       | Test Runner                            |
| --------- | ---------------------------------------------------------------------------- | -------------------------------------- |
| Behavior  | `click-outside-ignore.ts`, `resizable-handles.ts`, `movable-boundary.ts`     | Vitest + jsdom (existing)              |
| Focus     | `overlay-stack-focus.ts` (multi-tier), `zone-focus.ts` (AdminLayout regions) | Playwright (needs real focus tracking) |
| Plugin    | `plugin-events.ts`, `plugin-error-isolation.ts`                              | Vitest (pure logic)                    |
| Bootstrap | `bootstrap-session.ts`, `bootstrap-fs-persistence.ts`                        | Vitest + localStorage mock             |

The **cross-framework equivalence CI gate** should run after all ports:

```bash
# In CI: for each framework, build a JS bundle of the behavior suite and test
# it against the same contract scenarios. Failure = regression.
pnpm turbo run test:behaviors --filter=@iris-ui/{react,vue,solid,svelte}
```

### Code Review Checklist

For every core-sinking PR:

- [ ] Does the controller accept only plain JS primitives / framework-agnostic types? (No React `RefObject`, no Vue `Ref`, no Solid `Signal`, no Svelte `$state`)
- [ ] Does the controller use only `createStore` / `createMachine` / pure functions from core?
- [ ] Are all event/callback parameters typed as explicit interfaces (not `any`)?
- [ ] Does the controller have a test that proves it works without any DOM?
- [ ] Is the API split into "A: automatic zero-config" + "B: explicit `use`"?

For adapter porting PRs:

- [ ] Does the adapter use no JSX/SFC-specific logic beyond rendering and lifecycle bridges?
- [ ] Is the exact same `onXxx` callback signature passed through as the core controller emits?
- [ ] Does the adapter handle SSR gracefully (no `document`/`window` access in module scope)?
- [ ] Does the adapter have a "no-op when disabled" test?

### Performance Testing

| Test                                                  | Tool                               | Target                   | Direction |
| ----------------------------------------------------- | ---------------------------------- | ------------------------ | --------- |
| Virtualizer 1M row scroll throughput                  | `vitest bench` + Chrome DevTools   | <16ms per frame at 60fps | B         |
| Focus stack open/close latency (3 nested overlays)    | Playwright + `performance.now()`   | <8ms total               | C         |
| Plugin event bus throughput (1000 emits / 50 subs)    | Vitest bench                       | <5ms per emit            | D         |
| Behavior render overhead (100 resizable items)        | Vitest bench + adapter render test | No regression vs current | A         |
| Desktop OS cold start (profile hydrate → first paint) | Playwright tracing                 | <200ms                   | E         |

The benchmark suite B-05 serves double duty: it validates the virtualizer **and** establishes a regression baseline for future PRs.

---

## 6. Implementation Plan (Phase Detail)

### Milestones

| Milestone                            | Date          | Deliverable                                                                                                                                                               | Verification                                                                                                        |
| ------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **M1: Foundation**                   | End of Week 1 | Event bus + error isolation + focus stack + scheduler interface land in `@iris-ui/core`                                                                                   | All core unit tests pass. `pnpm size` shows <2KB increase per feature.                                              |
| **M2: Behaviors Sunk**               | End of Week 3 | All 4 behaviors (`createResizable`, `createClickOutside`, `createMovable`, `createHotkey`) live in core; 4 adapters consume them. Solid ClickOutside gains `ignore` refs. | 4-framework behavior equivalence CI gate passes. `packages/react/src/behaviors/` minus minimum bridge = -204 lines. |
| **M3: Focus Stack + Events Active**  | End of Week 4 | Multi-overlay focus preserves correct element. Plugins can subscribe/emit. CMS demo uses plugin event for cross-plugin notification.                                      | Multi-overlay Playwright test passes. Plugin A → B event contract passes.                                           |
| **M4: Virtualizer Production Ready** | End of Week 5 | Virtualizer has rAF coalescing, scheduler injection, IntersectionObserver optional, benchmark baseline. At least one demo app (desktop-os Files) uses it.                 | 1M-row benchmark <16ms per frame. CMS table (or equivalent) renders 10k rows without jank.                          |
| **M5: Startup Consolidated**         | End of Week 6 | `createAppBootstrap` used by all 4 desktop OS apps. Common boot sequencing profile→session→FS is no longer copy-pasted. SSR boot path verified.                           | All 4 desktop OS apps boot identically. SSR renderToString + hydrate matches.                                       |

### Phase 1 — Foundation (Week 1, 5 dev-days)

**Theme:** Plumb the infrastructure. No framework ports yet — all core.

| Day | Task(s)                                   | Owner          | Output                                                                      |
| --- | ----------------------------------------- | -------------- | --------------------------------------------------------------------------- |
| Mon | D-01: PluginEventBus core                 | Core architect | `packages/core/src/plugin.ts` updated with `emit`/`subscribe`/`channel` API |
| Tue | D-02: runPlugins error isolation          | Core architect | Single plugin failure doesn't block others; `onError` callback              |
| Wed | C-01: FocusStack core                     | Core architect | `packages/core/src/focus-stack.ts` with push/pop/pause/resume + full test   |
| Thu | B-01: Scheduler interface for virtualizer | Core architect | `packages/core/src/virtualizer.ts` exports `VirtualizerScheduler` type      |
| Fri | E-01: AppBootstrap interface definition   | Core architect | `packages/core/src/bootstrap.ts` interface + types                          |

**Risks this phase mitigates:** The foundation is used by every downstream task. By getting it done first, all subsequent work pins against stable abstractions. The event bus and focus stack in particular unlock the plugin+overlay work in Phase 3.

### Phase 2 — Core Controllers (Week 2-3, 10 dev-days, 3 tracks)

**Theme:** Parallel tracks — behaviors sink, virtualizer scheduling, plugin adapter bridges.

| Track               | Tasks                                        | Developer         | Key Risk                                                                                                                          |
| ------------------- | -------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **2A: Behaviors**   | A-01→A-05 sink 4 behaviors                   | Framework dev × 1 | Getting the core API right so 4 adapters can bridge cleanly. Mitigation: pair with core architect for 1h API review per behavior. |
| **2B: Virtualizer** | B-02→B-05 scheduler + rAF + benchmark        | Full-stack dev    | No consumer to validate. Mitigation: build synthetic 100k-row list in playground and measure.                                     |
| **2C: Plugins**     | D-03, D-04 (registerChannel + adapter hooks) | Core architect    | Adapter hook pattern must be consistent across 4 frameworks. Mitigation: build React first as reference, then port.               |

**Output of Phase 2:**

- `packages/core/src/resizable.ts` — delta-based resize controller (no pointer abstraction)
- `packages/core/src/click-outside.ts` — tree-walk + ignore-refs + SSR-safe
- `packages/core/src/movable.ts` — boundary-constrained delta machine
- `packages/core/src/hotkey.ts` — pattern-matching key combo engine
- `packages/core/src/virtualizer.ts` — rAF-coalesced window computation
- `packages/core/src/virtualizer.bench.ts` — 1M-row throughput baseline

### Phase 3 — Adapter Integration (Week 3-4, 8 dev-days, 2 tracks)

**Theme:** Every framework adapter ports to the new core controllers.

| Track                    | Tasks                                                                    | Developer                                  |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------ |
| **3A: Behavior Ports**   | A-06→A-09: React (4h), Vue (3h), Solid (3h), Svelte (3h)                 | Framework devs (2 devs, 2 frameworks each) |
| **3B: Focus Trap Ports** | C-03→C-06: React (3h), Vue (2h), Solid (2h), Svelte (2h)                 | Core architect + framework dev             |
| **3C: Tests**            | A-10, C-07, D-05: Verification + multi-overlay contract + event contract | QA specialist                              |

**Deliverables:**

- React `IrisResizable`/`IrisClickOutside`/`IrisMovable`/`IrisHotkey` are thin wrappers (<20 lines each)
- Same for Vue, Solid, Svelte
- Solid ClickOutside now supports `ignore` refs (currently missing)
- Focus trap restores to correct element across 3-deep overlay stack
- 4-framework behavior equivalence gate passes in CI

**Key metrics to verify:**

```
# React behaviors before/after (approximate)
Before:  4 adapters × ~70 lines = 280 lines of framework-specific logic
After:   4 adapters × ~15 lines = 60 lines of bridge + 400 lines of shared core
         Net code: 460 lines vs 280 → +180 lines core, –220 lines duplicate
         Duplication eliminated: ~44%
```

### Phase 4 — Startup + Focus Zone Protocol (Week 4-5, 8 dev-days)

**Theme:** Eliminate the desktop OS bootstrap copy-paste; add AdminLayout zone focus.

| Day | Task(s)                                             | Owner             | Output                                                                  |
| --- | --------------------------------------------------- | ----------------- | ----------------------------------------------------------------------- |
| Mon | E-02: `createAppBootstrap`                          | Core architect    | Bootstrap engine with phase sequencing + error handling                 |
| Tue | E-03, E-04: Session + FS phase plugins              | Full-stack dev    | Reusable phase plugins for profile hydrate, session restore, FS hydrate |
| Wed | C-08: Zone focus protocol                           | Core architect    | `AdminLayout` zone navigation strategy (sidebar→header→content→action)  |
| Thu | E-05, E-06: React + Vue desktop OS consolidation    | Core architect    | Desktop OS apps use `createAppBootstrap([sessionPhase, fsPhase])`       |
| Fri | E-07, E-08: Solid + Svelte desktop OS consolidation | Framework dev × 2 | Same bootstrap, framework-native call-site                              |

**Architecture decision for zone focus:**
The zone protocol should **not** be a new machine or controller — it extends `createRovingTabIndex` (already in core at `roving.ts`) with a `zone` config that groups roving contexts by `data-iris-zone`. When Tab exits the last focusable within a zone, it advances to the next zone's first item (not the browser's natural order). This is a pure data transformation over the existing roving model.

### Phase 5 — Bench + Polish + E2E (Week 6, 3 dev-days)

**Theme:** Validate everything under real conditions.

| Day | Task(s)                                 | Owner          | Output                                                                  |
| --- | --------------------------------------- | -------------- | ----------------------------------------------------------------------- |
| Mon | B-06: Virtual-scroll adapter validation | Full-stack dev | All 4 frameworks' virtual-scroll components work with new scheduler     |
| Tue | C-07 e2e: Multi-overlay Playwright test | QA specialist  | Flaky-free overlay focus test in CI                                     |
| Wed | E-09: SSR boot path verification        | Core architect | `renderToString` + `hydrate` matches for desktop OS in all 4 frameworks |

**Post-milestone decisions:**

- **Undertake D-06 (audit existing plugins) only if** the team has capacity and at least 2 plugin authors request cross-plugin event integration. Otherwise, defer to next cycle.
- **If virtualizer benchmark shows Fenwick tree overhead > 15% vs pure math at 10k rows** — add a fast-path threshold (≤10k rows → O(n) math, >10k → Fenwick tree). This is a 2h change.
- **If scope exceeds 6 weeks** — drop Solid/Svelte behavior ports to Phase 2 of next cycle. React/Vue have 80%+ of the user base.

---

## Summary

| Direction       | Tasks  | Total Effort | Risk Level | Priority                                                   |
| --------------- | ------ | ------------ | ---------- | ---------------------------------------------------------- |
| A: Behavior下沉 | 10     | 30h          | 🟠 Medium  | **High** (immediate DRY win, proven by LongPress/Sortable) |
| B: 虚拟器调度   | 6      | 16h          | 🔴 High    | Low (no consumer yet, fix before first adopter)            |
| C: 复合体焦点   | 8      | 22h          | 🟠 Medium  | **High** (accessibility gap in multi-overlay UX)           |
| D: 插件事件总线 | 6      | 16h          | 🟡 Low     | Medium (enables plugin ecosystem growth)                   |
| E: 启动编排器   | 9      | 23h          | 🟢 Low     | Medium (reduces copy-paste, SSR safety)                    |
| **Total**       | **39** | **107h**     | —          | Implement Phase 1→3→5 as written                           |

**Key recommendation:** Start with Phase 1 regardless. The four foundation tasks (D-01, D-02, C-01, B-01, E-01) are fully independent, fit in one week with one senior engineer, and de-risk all downstream work. After Phase 1, priorities should be:

1. **Behavior sinking (A)** — immediate DRY win with proven pattern, reduces adapter maintenance burden
2. **Focus stack (C)** — real a11y gap, multi-overlay patterns are becoming common in Iris UI demos
3. **Virtualizer scheduling (B)** — only when a first consumer appears (tie to a concrete PR)
4. **Startup orchestrator (E)** — reduces copy-paste but low user impact; schedule opportunistically
5. **Plugin event bus (D)** — build the interface but defer deep integration until cross-plugin demand materializes
