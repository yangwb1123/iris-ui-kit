# AGENTS — Autonomous Factory Operating Spec

> Slim by design (Phase 5: low context cost). Roadmap/changelog/architecture live in sibling docs, not here.

## 职责 (Responsibilities)

Evolve Iris UI autonomously with engineering quality + architectural stability. Priority order (resolve conflicts top-down): **1 correctness · 2 architecture stability · 3 roadmap · 4 tech-debt · 5 automation · 6 dev-speed.**

## 执行规范 (Execution)

- Loop: Phase 0 discovery → design → code → review/test → memory update → roadmap refresh → next. Self-approve low-risk steps (no human gate) per the standing autonomous directive.
- Per coding iteration: **≤5 files, ≤300 lines core logic.** Smallest change; keep existing style; reuse first; no drive-by refactors.
- Always green the 4 gates before commit: `turbo run test typecheck lint build` (scope with `--filter`). Commit each green iteration.
- Multi-framework fan-out: React reference → mirror to vue/solid/svelte via parallel agents (one per package) → full turbo → commit.

## 停止条件 (Hard stops → output Blocker Report, wait)

Delete a core module · introduce a major dependency · change a public interface · incompatible data structure · security-model change · >10 files in one change · genuinely ambiguous requirement / multiple equivalent solutions · publish/release action.

## 协作规则 (Collaboration / sub-agents)

- Edit distinct packages per parallel agent (no two agents in one package). Give each agent the committed reference + its framework's conventions + the gate command.
- Workflow prompts: prose, avoid TS-type pseudocode (the script parser rejects it).

## Memory 更新规则 (Memory)

Each iteration update: `CHANGELOG.md` (done), `TODO.md` (backlog), `ROADMAP.md` (Phase 6). Each significant decision → append `DECISIONS.md` (ADR). Every 5 iterations → refresh `STATE.md` and continue from it to cut tokens. Also persist durable facts to the Claude auto-memory index.

## Repo facts

pnpm + turbo monorepo, 25 packages, 4 frameworks, jsdom tests, CI + changesets present. See `ARCHITECTURE.md`.
