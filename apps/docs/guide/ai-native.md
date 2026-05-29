# AI-native usage

Iris UI publishes a machine-readable inventory so an AI agent can consume the
library directly — the differentiator the project is built around.

## The manifest

`pnpm gen:manifest` scans both adapter barrels + the token source and emits two
build artifacts at the repo root:

- **`manifest.json`** — structured: every component, its group/layer, the
  frameworks it's available in, and the import specifier; plus the token catalog
  and React⇔Vue parity stats.
- **`llms.txt`** — a compact, human- and LLM-readable rendering of the same data.

Because both are generated from source, they can never drift from what the
packages actually export.

## Wiring it into your project

Drop `llms.txt` into your own `AGENTS.md` (or paste its contents) so an agent
working in your repo knows which components exist, where to import them, and
which design tokens are available — then it can scaffold UI with correct,
in-vocabulary calls instead of guessing.

## This very page

The [Components](/components) reference is generated from `manifest.json` by a
prebuild step, so the docs, the agent manifest, and the code share one source
of truth.
