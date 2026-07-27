# AUTONOMOUS — Autonomous Factory Operating Spec

> Slim by design (Phase 5: low context cost). Roadmap/changelog/architecture live in sibling docs, not here.
> Root `AGENTS.md` = architectural spec. This file = autonomous execution rules.

## 职责 (Responsibilities)

Evolve Iris UI autonomously with engineering quality + architectural stability. Priority order (resolve conflicts top-down): **1 correctness · 2 architecture stability · 3 roadmap · 4 tech-debt · 5 automation · 6 dev-speed.**

## 执行规范 (Execution)

- Loop: Phase 0 discovery → design → code → review/test → memory update → roadmap refresh → next. Self-approve low-risk steps (no human gate) per the standing autonomous directive.
- Per coding iteration: **≤5 files, ≤300 lines core logic** (now machine-reported by `pnpm change-budget`; fan-out exempt). Smallest change; keep existing style; reuse first; no drive-by refactors.
- Green the scoped `test typecheck lint build` gates before an iteration is considered integrated. At release/workspace boundaries also run the root coverage, 27-package external pack/install, manifest/generated-docs/registry, size, token, RSC, browser E2E/visual, bench, desktop-parity and arch-ratchet gates declared in `package.json` and `.github/workflows/ci.yml`. The separate `native-linux` job must build/test Electron, Tauri and Wails with `IRIS_REQUIRE_NATIVE_BUILD=1`; the locally skippable shell wrappers are not a substitute for that strict CI proof.
- File-size is a **baseline ratchet**, NOT a hard 500-line rule (see ADR-008): `pnpm arch-check:ratchet` (CI gate) fails only on a NEW oversized file or GROWTH of a grandfathered one (`scripts/arch-baseline.json` — Table ×4 etc. are grandfathered). Do NOT split cohesive flagship files to chase 500 lines; after shrinking one, run `pnpm arch-check:baseline` to ratchet the ceiling down.
- Multi-framework fan-out: React reference → mirror to vue/solid/svelte via parallel agents (one per package) → full turbo → commit.

## 停止条件 (Hard stops → output Blocker Report, wait)

Delete a core module · introduce a major dependency · change a public interface · incompatible data structure · security-model change · >10 files in one change · genuinely ambiguous requirement / multiple equivalent solutions · publish/release action. Never set the maintainer-owned `IRIS_NPM_RELEASE_ENABLED` variable or bypass the release workflow's successful-`main`-push-CI and exact-`head_sha` preconditions.

## 协作规则 (Collaboration / sub-agents)

- Edit distinct packages per parallel agent (no two agents in one package). Give each agent the committed reference + its framework's conventions + the gate command.
- Workflow prompts: prose, avoid TS-type pseudocode (the script parser rejects it).

## Memory 更新规则 (Memory)

Each iteration update: `CHANGELOG.md` (done), `TODO.md` (backlog), `SPRINT.md` (current sprint). Each significant decision → append `DECISIONS.md` (ADR). Every 5 iterations → refresh `STATE.md` and continue from it to cut tokens. Also persist durable facts to the Claude auto-memory index.

## Repo facts

pnpm + Turbo monorepo, 27 publishable packages, 154 components × 4 adapters with 616 native manifest contracts and zero unavailable contracts, jsdom/SSR/browser tests, CI + changesets present. See `ARCHITECTURE.md`.
