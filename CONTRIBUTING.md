# Contributing to Iris UI

## Setup

```bash
pnpm install
pnpm build
```

## Workflow

1. Create a branch from `main`.
2. Make changes.
3. Run `pnpm lint && pnpm typecheck && pnpm test`.
4. Add a changeset: `pnpm changeset`.
5. Commit using [Conventional Commits](https://www.conventionalcommits.org/) — see examples in [AGENTS.md](./AGENTS.md).
6. Open a PR.

## Design Principles

Read [AGENTS.md](./AGENTS.md) — it is the source of truth for design decisions, naming conventions, and the architectural boundary between framework-agnostic state machines and framework adapters.

## Code Style

- TypeScript `strict` mode.
- All public APIs have JSDoc (JSDoc is the AI's context — write it for AI as much as humans).
- Component props are declarative; never accept functions as props (event callbacks are fine).
- Use `var(--iris-*)` for all colors, spacing, and radii — never hardcode.

## Testing

- State machines: 100% coverage.
- Rendering: 90% coverage.
- Tests use Vitest.

## Reporting Issues

Open a GitHub issue with:

- A minimal reproduction.
- Expected vs. actual behavior.
- Environment (Node version, package manager, OS).
