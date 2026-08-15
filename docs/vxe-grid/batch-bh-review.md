Verdict written to `/home/u1/iris-ui/docs/vxe-grid/batch-bh-review.md`.

## PASS — with 2 LOW findings, 0 blockers

**What I verified:**

- **Spec correctness** — every baseline anchor matches: props after `keymap` (`props.ts:400-410`), one-shot `useState` seed + controlled no-optimistic-flip memo, single choke point in the `groupPlan` memo (header + full count stay; rows + per-group summary skip; original `bodyData` indices preserved), both flat (:7770) and virtual (:6161) paths inherit, native `data-iris-group-toggle` button with `aria-expanded` + i18n labels, `data-iris-group-collapsed` on the row, all 7 fiats implemented and tested (12/12 tests pass). Hooks confirmed unconditional (no component-level early returns before :3934).
- **Additive only** — diff touches exactly `i18n.ts`, `props.ts`, `Table.tsx`, `types.ts` (doc), new test, regenerated manifest; vue/solid/svelte, `data-view.ts`, row/body/styles untouched; the 39 deleted lines are only the re-written `renderGroupHeader` JSX.
- **Manifest hygiene** — `check:manifest` regenerates to identical output; propCount 149→152, eventCount 28→29, `onGroupCollapseChange` present in both manifest.json and llms.txt event lists; manifest tests 69/69.
- **Core framework-free** — core grep empty; only +2 i18n strings.
- **CSS tokens** — all 8 tokens canonical (`iris.space.*`, `iris.font.size.*`, …), no hex.
- **Gates** — core 1469/1469 · react 2163/2163 · typecheck clean · lint 0 errors (complexity warning pre-existing, confirmed via batch-bg-review) · audit:security 0 vulns.

**Findings:** (1) LOW — test passes redundant `ref={ref}` alongside `tableRef` → React warning on stderr; (2) LOW — uncontrolled-mode callback firing untested (code correct); (3) INFO — `audit:tokens` exit-1 is a pre-existing repo-wide legacy-token condition, zero BH contribution; (4) INFO — AGENTS.md 154 vs manifest 155 component count is pre-existing drift.
