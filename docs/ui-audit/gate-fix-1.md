# Gate-Fix Round 1 — Design-token correction (ui_reviewer FAIL + visual_reviewer Low)

**Round context**: `ui_reviewer.md` returned **VERDICT: FAIL** (1 Medium blocking + 2 Low mechanical),
`visual_reviewer.md` returned **PASS** (89/100) with 1 Low token-value item. This round fixes every
in-scope item. Fixes are **token values / token-consumption only** — no props, events, DOM, or
component structure changed (consistent with the "No API change" constraint of the unification).

## Audit result (re-run after fixes)

- `iris-ui-spec.py --mode all --json` → **0 violations / 1391 files**, exit 0
- `iris-ui-spec.py --mode all --pkg plugins --json -o docs/ui-audit/plugins.json` → **0 / 115 files**, exit 0

## Fixes

### 1. `--iris-on-color` dark value — blocking (ui_reviewer #1, change-introduced regression)

- **Before**: `packages/tokens/src/dark.ts:22` `'iris.on.color': '#0b1020'` — near-black on
  arbitrary user-supplied `event.color` in dark mode ≈ **1.4:1, unreadable** (the prior gate
  prescribed a theme-stable `#fff`; the token was created but with the wrong dark value).
- **Fix**: `'#0b1020'` → `'#ffffff'` — now identical in both themes (light.ts:22 already `#ffffff`).
  Sole consumer verified (plugins + primitives): the user-colored calendar event chip in all 4
  renderers (react:168 / solid:166 / svelte:122 / vue:114), whose fallbacks already read `#ffffff`.
  Zero collateral. Primary-surface pairing remains on `--iris-primary-foreground` (untouched).

### 2. `--iris-dashboard-widget-radius` dual-path drift — Low (ui_reviewer #2)

- **Before**: registration `'var(--iris-radius-md)'` = **6px** (core:116) vs 4 consumer fallbacks
  **8px** — standalone renders 8px, installed renders 6px; and 8px is off the radius scale
  {6,10,16} (geometry contract).
- **Fix**: 4 fallbacks `8px` → `6px` (react:178 / solid:171 / svelte:150 / vue:233) — aligned with
  registration, on-scale. Registration + `core/index.test.ts:154` assertion untouched.

### 3. Light WIP badge contrast — Low (visual_reviewer, token values only)

- **Before**: `'iris.warning.foreground': '#78350f'` on `#f59e0b` = **4.22:1** — misses AA 4.5:1
  for the 0.7em badge text (dark theme already `#451a03`).
- **Fix**: `light.ts:20` → `'#451a03'` (**6.95:1** AA ✓, matches dark value) + fallback sync in the
  4 kanban WIP-badge consumers (react:167 / solid:168 / svelte:148 / vue:144). Sole consumer
  verified: kanban WIP badge only. Dark contrast unchanged at **8.97:1**.

### 4. Calendar event-chip radius `3px → 4px` — Low (ui_reviewer #5, off-scale radius)

- 3px was the lone off-scale chip radius; kanban chips already use 4px (established micro-chip
  language). Aligned ×4 (react:170 / solid / svelte:123 / vue). Reviewer-sanctioned ("4 or 8").

### 5. `--iris-padding-sm` = 6px — Low (ui_reviewer #3): **documented exception, not changed**

The reviewer offered two resolutions: switch kanban chips to `--iris-space-xs` (8px) **or**
explicitly document `padding.sm=6` as an intentional library-scale exception. Chosen: document.
Rationale: `padding.sm` is a **library-wide dense-control token** (~30 consumers across
primitives — Button, Input, Select, Combobox, Menu, Tree, TagInput, Kbd, Table…, plus the
standard `space-xxs + padding-sm` chip pattern shared by kbd/tag-input/table/time-picker/kanban).
Switching only kanban to 8px would make kanban chips diverge from the registered token _and_ from
every sibling chip — recreating the exact dual-path drift this change eliminates elsewhere;
retuning the registration to 8px would silently re-pad every control in the library (out of a
plugin-scope fix round). 6px sits in the micro-component 4–8px band of the spacing relation
layers. Documented via comments in `light.ts`/`dark.ts` spacing sections.

### 6. Pre-existing `themes.test.ts` stale formula — test assertion update

`ALL_TOKEN_NAMES` (working tree, prior session) = 81 names; the count formula hardcoded
`+ 3 + 8 + 5` while `SHADOW_TOKENS` had grown to 4 (`iris.shadow.xl`) → 81 vs 80 failure
(pre-existing — reproduced with my changes stashed). Formula now mirrors `ALL_TOKEN_NAMES`
structurally (uses `SHADOW_TOKENS/ZINDEX_TOKENS/TRANSITION_TOKENS.length`).

## Gate results (all re-run)

| Gate                           | Result                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Audit `--mode all`             | 0 / 1391 files, exit 0                                                                                                    |
| Audit `--pkg plugins`          | 0 / 115 files, exit 0                                                                                                     |
| tokens tests                   | **24/24** (was 1 failed — stale formula fixed)                                                                            |
| calendar tests                 | **45/45** (36 main + 9 svelte/solid configs)                                                                              |
| kanban tests                   | **43/43** (35 + 8)                                                                                                        |
| dashboard tests                | **45/45** (36 + 9)                                                                                                        |
| typecheck (tsc + svelte-check) | tokens/kanban/dashboard **0 errors**; calendar **0 errors** (2 pre-existing a11y warnings on interactive divs, unrelated) |
| git hygiene                    | no `dist/`, no `*.tgz` in `git status --porcelain`                                                                        |

## Explicitly out of scope (pre-existing, reviewer-labelled follow-up)

- **Loading/empty/error states** in plugin data regions (ui_reviewer #4, Medium pre-existing):
  structural work — requires component API decisions (skeleton/empty/error props), not a token
  fix. Left untouched; recommended as a separate structural task.
- `--iris-cal-event-bg, rgba(99,102,241,0.15)` (ui_reviewer #6, Info): accepted as documented
  deviation — plugin-local token ≈ derived `primary-subtle`, audit-exempt, consistent ×4.

## Deviations / notes

1. Dashboard widget radius 8px → 6px is a 2px optical change on the widget corner; required for
   registration↔fallback lockstep and radius-scale compliance.
2. Event-chip radius 3px → 4px; kanban chips already 4px — no visual outlier introduced.
3. All edits are on the pre-existing uncommitted working tree (45 plugin files + tokens package
   from prior sessions of this pipeline round); nothing committed, nothing outside
   `packages/plugin-{calendar,kanban,dashboard}/src` + `packages/tokens/src` touched.
