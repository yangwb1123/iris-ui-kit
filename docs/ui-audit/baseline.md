Baseline audit complete. Summary of what was done:

## Deliverables

**1. Audit run** — `iris-ui-spec.py --mode all --json` → `docs/ui-audit/report.json`, freshly regenerated at 03:06 AKDT:

- **169 violations** across **1,391 scanned files** (exit code 1 = violations present, expected)
- **Per-category**: spacing **169** (100%); font 0, hex 0, shadow 0 — verified independently by running each mode separately
- **Per-package**: solid 55, react 47, svelte 29, vue 19, plugin-kanban 11, plugin-charts 4, plugin-pro-table 4
- **Top files** (119 distinct; ties at rank 10): split-button in react/solid/svelte (4 each) + plugin-kanban react (4); combobox/command-palette/kbd/kanban adapters (3 each)
- Spacing detail: 155 style-object / 9 CSS-block / 5 numeric; padding 158, margin 10, gap 1; off-scale values are 2/5/6/7/10/14px

**2. Summary written** — `docs/ui-audit/REPORT.md` (overwrote the stale 00:38 version) with totals, category table, package table, top-10 files, and a fix priority queue (solid → react → svelte → vue → plugins; split-button/kanban cross-framework groups are the high-leverage targets).

**Important finding**: the old REPORT.md claimed 578 violations (font 303/hex 119/spacing 103/shadow 53), but the scanner script was updated at 03:04 (untracked in git, no history). The fresh run shows font/hex/shadow are now clean — the 169-spacing figure is the current-script baseline and is flagged as such in the report.

**3. Read-only verified** — only writes were `report.json` (scanner output) and `REPORT.md` (documentation); no source files touched.
