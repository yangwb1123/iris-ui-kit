Review complete. Verdict written to `docs/vxe-grid/batch-dj-review.md`.

## Verdict: **PASS** (1 low-severity formatting finding)

### What I verified

- **Spec correctness** — `inShortcutScope` gate (Table.tsx:7186-7206) implements exactly the baseline design: `outerScope`→global, `hotkeyScope:false`→permissive, default→in-table. Live `e.target` read, no new focus/blur state. All **4** window keydown listeners wired (undo, clip, fnr, batch-edit); the 2 modal Escape listeners (zoom/import-preview) correctly left out. Deps arrays patched with `inShortcutScope` → no stale closure.
- **Additive only** — react-only, all new props defaulted, only 1 existing test legitimately updated to match the intended anywhere→in-table tightening.
- **Manifest hygiene** — `check:manifest` passes, 190→192 props, and it's _honest_: only the react frameworkContract carries the new props (vue/solid/svelte unpolluted).
- **Core framework-free** — zero core files changed; framework grep empty.
- **CSS tokens** — no new tokens/hex/hardcoded styles.

### Gates (all green)

core test 1584 ✅ · react test 2770 ✅ · typecheck ✅ · lint 0 errors ✅ · audit 0 vulns ✅ · check:manifest ✅

### Finding (LOW)

- **Table.tsx:7249 / :7286** and **hotkey-scope.test.tsx:159-161/:169-176** introduce Prettier `format:check` violations (over-length dep-array and render lines). Trivially fixed with `prettier --write`; does not affect any functional or requested gate. Note the repo-wide `format:check` already fails on 5 pre-existing parallel-session files, so it's not the binding bar.
