# Iris UI — Skin System Design

> Status: **Approved design → ready for implementation plan**
> Date: 2026-05-30
> Topic: Loadable, token-built skins with a marketplace SDK, inheritance + custom tokens, and full runtime (persist / FOUC-safe / follow-system / live-edit).
> Author: design via `superpowers:brainstorming`.

## 1. Problem & Intent

The theme layer today (`@iris-ui-kit/theme`) ships a **closed, static** model:

- `IrisTheme` is a fully-specified object over a fixed 21-token schema (12 colors + 6 spacing + 3 radii). Every theme must define **all** keys.
- `createThemeStore({ themes, default })` registers a **static** map at construction. There is no register-after-construction, no validation, no async loading, no discovery, no inheritance, no extra token namespaces.
- `applyTheme` writes inline CSS custom properties + `data-iris-theme*` attributes and returns `revert()`.

The user's requirement: **a skin system that can load different skins, where skins are built through tokens.** Through `AskUserQuestion` the user chose the **maximal** scope on all three axes:

1. **Loading = "Full marketplace SDK"** — a remote catalog/manifest with versioning and discovery; lazy-fetch a skin by id; async URL/JSON load into a runtime registry.
2. **Composition = "Inheritance + custom tokens"** — partial overrides, `extends` (single or multi-parent), and arbitrary extra token namespaces **beyond** the fixed 21.
3. **Runtime = ALL FOUR** — persist selection (localStorage), FOUC-safe apply (pre-paint / SSR boot script), follow system light/dark, and a live-edit API.

A **skin** is a superset of a theme: it resolves down to a valid `IrisTheme` (so every existing component keeps working unchanged) **plus** an optional bag of custom CSS variables. Skins compose via inheritance; they can be authored partially and loaded at runtime from a catalog.

## 2. Design Principles (inherited from the codebase)

- **Logic sinks to core.** All skin logic — validation, inheritance resolution, registry, engine orchestration, fetch/parse — is **framework-agnostic** and lives in a new `@iris-ui-kit/skins` package built on `@iris-ui-kit/core`'s `createStore`. React/Vue ship **thin** adapters (mirroring `ThemeProvider`/`useTheme`).
- **Pure vs. effectful split.** `validateSkin`, `resolveSkin`, registry mutations, and style-string rendering are **pure** (no DOM, no network). DOM writes (`applySkin`) and network (`loadSkin`, catalog fetch) are isolated, injectable side-effects. This keeps SSR-safety and testability identical to the theme layer.
- **Closed schema stays closed; custom tokens are additive.** The 21-token `IrisTheme` contract is unchanged — components still read `var(--iris-*)`. Custom tokens are an **explicit, separate** namespace that never silently mutates the core schema.
- **No throwing into render.** All failure modes surface as typed `SkinError` values / rejected promises at the engine boundary — never thrown synchronously inside a component render. (Matches the async-resource three-state philosophy already in core.)
- **Parity is mandatory.** React ⇄ Vue semantic parity, mirrored test suites, all four quality gates green (`turbo run test typecheck lint build`) + `pnpm size` + `pnpm check:rsc` + `pnpm format:check`.
- **Marketplace = client SDK + a manifest contract.** We ship the **consumer side** (manifest schema + a catalog client that fetches/validates/caches). We do **not** build a hosted server, auth, signing, or a visual editor UI — those are out of scope (YAGNI). A catalog is just a static JSON manifest at a URL plus per-skin JSON documents.

## 3. Data Model

### 3.1 `Skin` (authoring shape — partial / composable)

```ts
interface Skin {
  /** Stable unique id, e.g. "acme-dark" or "ocean@1.2.0". Used as registry key + catalog lookup. */
  id: string
  /** Human-facing display name. Falls back to `id` when omitted. */
  name?: string
  /** Semver-ish version string. Optional; the catalog may pin/range it. */
  version?: string
  /** Light/dark hint. If omitted, inherited from the resolved parent chain, else 'light'. */
  type?: IrisThemeType
  /**
   * Inheritance. A parent id (string) or ordered list of parent ids (later wins).
   * Parents must be resolvable from the same registry. Cycles are a validation error.
   */
  extends?: string | string[]
  /**
   * Partial overrides of the 21 core tokens. Colors are strings; spacing/radii are numbers.
   * Anything omitted is inherited from the parent chain (and ultimately the base skin).
   */
  tokens?: Partial<IrisThemeColors & IrisThemeSpacing & IrisThemeRadii>
  /**
   * Free-form custom tokens beyond the closed schema. Keys are dot-notation token names
   * (e.g. "iris.shadow.card", "brand.gradient.hero"); values are strings or numbers
   * (numbers → "<n>px"). Mapped to CSS vars via the same `toCssVarName` rule. Merged
   * across the inheritance chain, child wins.
   */
  custom?: Record<string, string | number>
  /**
   * Optional light/dark companions for system-follow. When the engine is in
   * 'system' mode it switches between `variants.light` / `variants.dark` ids.
   */
  variants?: { light?: string; dark?: string }
  /** Icon set name + per-icon aliases (pass-through to IrisTheme.icons / iconOverrides). */
  icons?: string
  iconOverrides?: Record<string, string>
  /** Free-form catalog/display metadata (author, description, tags, preview URL). Not applied to the DOM. */
  meta?: Record<string, unknown>
}
```

Notes:

- `tokens` is a **partial** of the three core token records keyed by the canonical dot names already exported from `@iris-ui-kit/tokens` (`ColorToken | SpacingToken | RadiusToken`). Validation rejects unknown core-token keys (a typo'd `iris.primaryy` is an error, not a silent custom token).
- `custom` is the escape hatch for **extra namespaces**. It is deliberately separate from `tokens` so the closed schema can never be accidentally widened, and so a typo in a core token can be caught.

### 3.2 `ResolvedSkin` (runtime shape — fully specified)

```ts
interface ResolvedSkin {
  id: string
  name: string
  type: IrisThemeType
  /** A complete, valid IrisTheme — guarantees all 21 tokens are present. Drop-in for applyTheme/components. */
  theme: IrisTheme
  /** Fully-merged custom token map (dot-notation → string|number). */
  custom: Record<string, string | number>
  /** Resolution order, base → leaf, e.g. ['dark', 'acme-base', 'acme-dark']. */
  lineage: string[]
  variants?: { light?: string; dark?: string }
  /** The original authoring Skin this resolved from (for round-tripping / live-edit). */
  source: Skin
}
```

`resolveSkin` produces a `ResolvedSkin` whose `.theme` is a **complete** `IrisTheme`. Because the base skins (`light`/`dark`, registered from `@iris-ui-kit/tokens`) are complete, any chain rooted at a base is guaranteed complete; a chain **not** rooted at a base that leaves a core token undefined is a validation error (reported, never a half-applied DOM).

### 3.3 `SkinManifest` (marketplace contract)

```ts
interface SkinManifestEntry {
  id: string
  name?: string
  version?: string
  type?: IrisThemeType
  /** Where to fetch the full Skin JSON. Relative to the manifest URL or absolute. */
  url: string
  /** Optional inline metadata for discovery UIs (tags, author, preview) without fetching the skin. */
  meta?: Record<string, unknown>
}

interface SkinManifest {
  /** Manifest schema version for forward-compat. */
  schema: 1
  skins: SkinManifestEntry[]
}
```

The "marketplace" is exactly this: a `manifest.json` listing entries + a `url` per skin. No server logic. The catalog client fetches the manifest, lists/searches entries, and lazy-fetches `url` → `Skin` on demand (with an in-memory cache).

## 4. Package & Module Layout

New package **`@iris-ui-kit/skins`** (deps: `@iris-ui-kit/core`, `@iris-ui-kit/tokens`, `@iris-ui-kit/theme`), plus thin adapter modules added under the existing `@iris-ui-kit/react` and `@iris-ui-kit/vue` packages.

```
packages/skins/                         ← @iris-ui-kit/skins (framework-agnostic)
  package.json  tsup.config.ts  tsconfig.json  vitest.config.ts
  src/
    index.ts                 barrel
    types.ts                 Skin, ResolvedSkin, SkinManifest*, SkinError, SkinStorage, mode types
    errors.ts                SkinError (typed, non-throwing-by-default helpers)
    validateSkin.ts          pure: shape + token-key + value-type checks → SkinError[]
    resolveSkin.ts           pure: extends-chain merge, cycle/missing detection, completeness check
    registry.ts              createSkinRegistry: register/get/has/list/remove over a Map (pure, in-memory)
    applySkin.ts             effectful: applyCssVars(theme+custom) to target; returns revert()
    renderSkinStyle.ts       pure: ResolvedSkin → CSS text (":root{--iris-…}") for FOUC/SSR
    bootScript.ts            pure: returns the inline <script> string for FOUC-safe pre-paint apply
    storage.ts               SkinStorage interface + localStorageSkinStorage() + memorySkinStorage()
    loadSkin.ts              effectful: fetch URL | parse JSON → validate → Skin (injectable fetch)
    catalog.ts               createSkinCatalog({ manifestUrl, fetch? }): load/list/search/get/fetchSkin (cached)
    engine.ts                createSkinEngine(...): orchestrator over store + registry + catalog + storage
    builtins.ts              base skins from light/dark themes (id 'light' / 'dark')
    *.test.ts                pure unit + jsdom + mocked-fetch suites

packages/theme/src/
  applyCssVars.ts            ← REFACTOR: extracted from applyTheme; writes [name,value][] to target, returns revert()
  applyTheme.ts              ← now delegates entry-collection + write to applyCssVars (behavior unchanged)

packages/react/src/skins/
  SkinProvider.tsx  useSkin.ts  index.ts  *.test.tsx
packages/vue/src/skins/
  SkinProvider.ts   useSkin.ts  index.ts  *.test.ts
```

### Dependency graph

```
core ─┬─ tokens ─┬─ theme ─┬─ skins ─┬─ react (adapter)
      │          │         │         └─ vue   (adapter)
      └──────────┴─────────┘
```

No cycles; `skins` sits above `theme` exactly where the (now-richer) theme primitives are reused.

## 5. Core Units (framework-agnostic)

### 5.1 `validateSkin(skin, opts?) → SkinError[]` (pure)

- Checks: `id` non-empty string; `type` ∈ {light,dark} if present; `extends` entries are strings; `tokens` keys ∈ the canonical token-name set (`ALL_TOKEN_NAMES`); color values are strings, spacing/radii values are numbers; `custom` keys are valid dot-notation, values string|number; `variants.*` are strings.
- Returns an array of `SkinError` (empty = valid). **Never throws.** The engine decides whether to reject.

### 5.2 `resolveSkin(skin, registry) → ResolvedSkin` (pure)

- Walks `extends` depth-first, base → leaf, building `lineage`. Detects **cycles** (id already on the current path) and **missing parents** (id not in registry) → throws a typed `SkinError` (caught by the engine; `resolveSkin` is the one place a throw is acceptable because callers always wrap it).
- Merges in order: start from an empty partial; for each ancestor then self, shallow-merge `tokens` and `custom` (child wins), carry `type`/`icons`/`iconOverrides`/`variants` (last defined wins).
- Splits merged `tokens` back into `colors`/`spacing`/`radii` by membership in `COLOR_TOKENS`/`SPACING_TOKENS`/`RADII_TOKENS` to build the `IrisTheme`.
- **Completeness gate:** if any of the 21 core tokens is still undefined after merge → `SkinError('incomplete', missingKeys)`. (Chains rooted at a base skin never hit this.)

### 5.3 `createSkinRegistry(initial?) → SkinRegistry` (pure, in-memory)

```ts
interface SkinRegistry {
  register(skin: Skin): SkinError[] // validates; registers only if valid; returns errors (empty = ok)
  get(id: string): Skin | undefined
  has(id: string): boolean
  list(): Skin[]
  remove(id: string): boolean
  resolve(id: string): ResolvedSkin // resolveSkin against this registry; throws SkinError if absent/invalid
}
```

Built-in `light`/`dark` base skins (derived from `@iris-ui-kit/tokens` themes in `builtins.ts`) are registered by default so partial skins can `extends: 'dark'` out of the box.

### 5.4 `applyCssVars(entries, target) → { revert() }` (effectful, in `@iris-ui-kit/theme`)

Extracted from the current `applyTheme` so both theme and skin layers share one DOM-write path. `applyTheme` is refactored to call it (identical observable behavior; its tests stay green). `applySkin` reuses it for core + custom tokens and sets `data-iris-skin` / `data-iris-skin-type` (alongside the existing `data-iris-theme*`).

### 5.5 `applySkin(resolved, target?) → { revert() }` (effectful)

Collects entries from `resolved.theme` (colors as-is, spacing/radii `${n}px`) **and** `resolved.custom` (numbers → `${n}px`), writes via `applyCssVars`, sets skin data-attrs, returns `revert()`.

### 5.6 `renderSkinStyle(resolved, selector = ':root') → string` (pure)

Returns CSS text (`:root{--iris-background:…;…}`) for the resolved skin's core + custom vars. Used for **SSR** (inline `<style>`) and as the body of the FOUC boot script. No DOM access — safe on the server.

### 5.7 `skinBootScript({ storageKey, skins, fallbackId }) → string` (pure)

Returns a tiny self-contained inline `<script>` body (string) the host drops in `<head>` **before** first paint. At runtime in the browser it: reads the persisted skin id from storage (or system preference for 'system' mode), looks up a pre-serialized CSS string for that id from an embedded map, and writes it to `document.documentElement` — eliminating FOUC on first load and SSR hydration. Pre-serialization uses `renderSkinStyle`, so the script ships only strings (no resolver logic, keeps it tiny).

### 5.8 `SkinStorage` (interface) + adapters

```ts
interface SkinStorage {
  get(): string | null
  set(id: string): void
  remove(): void
}
```

`localStorageSkinStorage(key='iris-skin')` — SSR-safe (no-op when `window`/`localStorage` undefined, mirroring `watchColorScheme`'s guard). `memorySkinStorage()` — for tests/SSR. Pluggable: a host can supply cookies/IDB.

### 5.9 `loadSkin(source, opts?) → Promise<Skin>` (effectful)

- `source: string` → treated as a URL: `fetch` → `res.json()` → `validateSkin` → resolve or reject with `SkinError('load', …)`.
- `source: object` → treat as inline JSON: `validateSkin` → resolve/reject.
- `fetch` is injectable (`opts.fetch`) for tests and non-browser runtimes; defaults to global `fetch`, with a typed error when unavailable.

### 5.10 `createSkinCatalog({ manifestUrl, fetch? }) → SkinCatalog` (effectful, cached)

```ts
interface SkinCatalog {
  load(): Promise<SkinManifestEntry[]> // fetch + validate manifest (idempotent, cached)
  list(): SkinManifestEntry[] // entries from the last load (sync)
  search(query: string): SkinManifestEntry[] // name/id/tag substring match over loaded entries
  get(id: string): SkinManifestEntry | undefined
  fetchSkin(id: string): Promise<Skin> // lazy-fetch entry.url via loadSkin; in-memory cached
}
```

The **client half** of the marketplace. No server, no auth, no signing. Manifest URL → entries; `fetchSkin(id)` resolves the entry's `url` to a validated `Skin`.

### 5.11 `createSkinEngine(config) → SkinEngine` (orchestrator)

The single integration point adapters consume. Wires registry + store + (optional) catalog + storage + system-follow.

```ts
interface SkinEngineConfig {
  skins?: Skin[] // pre-registered skins (besides built-in light/dark)
  default: string // initial skin id (or 'system')
  catalog?: SkinCatalog // optional marketplace client
  storage?: SkinStorage // optional persistence (default: none; adapter may inject localStorage)
  mode?: 'fixed' | 'system' // 'system' follows prefers-color-scheme via watchColorScheme
}

interface SkinEngine {
  store: Store<ResolvedSkin> // subscribable current resolved skin (core createStore)
  current(): ResolvedSkin
  availableSkins(): Skin[]
  setSkin(id: string): void // resolve from registry + persist + push to store
  loadSkin(source: string | Skin): Promise<ResolvedSkin> // load → register → setSkin
  attachCatalog(catalog: SkinCatalog): void
  useFromCatalog(id: string): Promise<ResolvedSkin> // catalog.fetchSkin → register → setSkin
  setMode(mode: 'fixed' | 'system'): void // toggles prefers-color-scheme follow
  patch(overrides: { tokens?; custom? }): void // LIVE EDIT: non-destructive overlay on current skin
  resetPatch(): void // drop the live-edit overlay
  subscribe(listener): () => void // delegates to store.subscribe
  destroy(): void // unsubscribes system watcher; clears listeners
  errors(): SkinError[] // last non-fatal errors (load/validate), for UIs
}
```

- **Persist:** `setSkin`/`loadSkin` call `storage.set(id)`; engine init reads `storage.get()` and falls back to `default`.
- **Follow-system:** in `'system'` mode the engine subscribes to `watchColorScheme` (reused from `@iris-ui-kit/theme`) and switches between `current.variants.{light,dark}` (or the base `light`/`dark` ids when the active skin declares no variants).
- **Live edit:** `patch` keeps a **non-destructive overlay** — it re-resolves `current.source` merged with the overlay and pushes the result to the store **without mutating the registered skin**. `resetPatch` drops the overlay and re-resolves clean. This powers a theming/editor UI (live token tweaking) without corrupting saved skins.
- **Errors:** load/validate failures accumulate into `errors()` (and reject the relevant promise) — never thrown into a subscriber.

## 6. Framework Adapters (thin — mirror ThemeProvider/useTheme)

### React — `packages/react/src/skins/`

- `SkinProvider({ engine, target?, children })`: subscribes via the existing `useStore(engine.store)`; on change `applySkin(current, target)` and revert on cleanup; `injectGlobalStyles()` once (as `ThemeProvider` does). Provides engine through context. RSC-safe: `'use client'` boundary like the other adapters.
- `useSkin()`: `{ skin: ResolvedSkin, setSkin, loadSkin, useFromCatalog, patch, resetPatch, setMode, availableSkins, errors }`.
- `useSkinOptional()`: non-throwing read for skin-aware primitives rendering standalone (mirrors `useThemeOptional`).

### Vue — `packages/vue/src/skins/`

- `SkinProvider` (renderless `defineComponent`): `ref(engine.current())` synced via `engine.store.subscribe`; `onMounted` → `injectGlobalStyles()` + `applySkin`; `watch` re-applies; `onBeforeUnmount` reverts + unsubscribes. `provide(IrisSkinKey, …)`.
- `useSkin()`: same surface as React, with `ComputedRef` for `skin`.

Both adapters contain **zero** skin logic — pure bridges, exactly like the theme adapters. Both packages re-export the `skins` subpath (`@iris-ui-kit/react/skins`, `@iris-ui-kit/vue/skins`) via the existing `./*` exports wildcard, and the new `@iris-ui-kit/skins` is added to each adapter package's deps.

## 7. Error Model

```ts
type SkinErrorCode = 'validate' | 'cycle' | 'missing-parent' | 'incomplete' | 'load' | 'catalog'
interface SkinError {
  code: SkinErrorCode
  message: string
  id?: string
  keys?: string[]
}
```

- Pure validators/resolvers **return** `SkinError[]` (or, for `resolveSkin`, throw a single `SkinError` that the engine wraps).
- Effectful units **reject** promises with `SkinError`.
- The engine **never** throws into a store subscriber; surfaces problems via `errors()` and rejected promises. (Consistent with the no-throw-into-render rule and the async three-state model already in core.)

## 8. Testing Strategy

- **Pure units** (`validateSkin`, `resolveSkin`, `registry`, `renderSkinStyle`, `bootScript`, `storage` memory impl): deterministic Vitest unit tests — inheritance merge order, child-wins, cycle detection, missing parent, incompleteness, unknown-token rejection, custom-namespace round-trip, number→px.
- **jsdom** (`applyCssVars`, `applySkin`, localStorage storage, adapters): CSS-var writes + revert, data-attrs, persist round-trip, FOUC script string correctness, system-follow via mocked `matchMedia`.
- **Mocked fetch** (`loadSkin`, `catalog`): injectable fetch returns canned manifest/skin JSON; assert validation, caching, lazy-fetch, error rejection.
- **Adapters**: React (`@testing-library/react`) + Vue (`@vue/test-utils`) — provider applies on mount, `useSkin().setSkin` switches + re-applies, reverts on unmount, `useFromCatalog` happy path with mocked catalog. **Mirrored** suites both ends.
- **SSR smoke**: `renderSkinStyle` + `bootScript` run under `// @vitest-environment node` (no DOM) without touching `document`.
- **Theme regression**: existing `applyTheme` tests must stay green after the `applyCssVars` refactor (behavior-preserving).

## 9. Build / Packaging

- `packages/skins/`: tsup (ESM+CJS+dts+sourcemaps, `target es2022`, `treeshake`, `clean`), `external: ['@iris-ui-kit/core','@iris-ui-kit/tokens','@iris-ui-kit/theme']`, `sideEffects: false`, `exports` with `.` + `./*` wildcard (consistent with the size-budget subpath story).
- Add to `pnpm size` budget (gzip) like the other packages.
- `@iris-ui-kit/manifest`: extend the generator to emit skin-system surface if it enumerates package exports (verify during implementation; do not fabricate).
- New package wired into `turbo` topological build via workspace deps (no turbo.json change needed — pipelines already glob packages).

## 10. Out of Scope (YAGNI)

- Hosted marketplace **server**, account/auth, skin **signing**/verification, paid distribution.
- A visual **skin-editor UI** (the engine exposes `patch`/`resetPatch`/`renderSkinStyle` so one _could_ be built later, in an app, not the library).
- Theme **migration tooling** / codemods.
- Non-CSS-variable theming backends (Tailwind config emit, etc.).
- Per-component skin scoping beyond the existing `target` element mechanism inherited from `applyTheme`.

## 11. Verification (done = all green)

1. `pnpm install` clean.
2. `pnpm turbo run build` — `@iris-ui-kit/skins` emits `dist/{index.js,index.cjs,index.d.ts}`, no warnings; adapters build.
3. `pnpm turbo run typecheck` — whole workspace.
4. `pnpm turbo run test` — all new pure/jsdom/mocked-fetch/adapter suites + unchanged theme suite pass.
5. `pnpm turbo run lint` + `pnpm format:check` clean.
6. `pnpm size` within budget (skins package added).
7. `pnpm check:rsc` — React skins adapter respects the `'use client'` boundary.
8. Manual API review: `@iris-ui-kit/skins` core units have **zero** `react`/`vue` imports and pure units have **zero** DOM/network references.
9. React ⇄ Vue adapter parity: mirrored test files, equivalent public surface.
10. No `dangerouslySetInnerHTML` / `innerHTML` / `v-html` anywhere (the boot script is a string the **host** injects; the library never injects raw HTML into a framework tree).

## 12. Build Sequence (for the implementation plan)

1. **theme refactor** — extract `applyCssVars` from `applyTheme`; keep theme tests green. (Enabling, behavior-preserving.)
2. **skins types + errors** — `types.ts`, `errors.ts`.
3. **pure core** — `validateSkin`, `resolveSkin`, `registry`, `builtins` (+ tests).
4. **render/boot/storage** — `renderSkinStyle`, `bootScript`, `storage` (+ tests).
5. **effectful** — `applySkin`, `loadSkin`, `catalog` (+ jsdom/mocked-fetch tests).
6. **engine** — `createSkinEngine` orchestrator (+ tests: persist, system-follow, live-edit, catalog).
7. **barrel + package wiring** — `index.ts`, `package.json`, `tsup`, `tsconfig`, `vitest`, size budget.
8. **React adapter** — `SkinProvider`/`useSkin`/`useSkinOptional` (+ tests, `'use client'`).
9. **Vue adapter** — `SkinProvider`/`useSkin` (+ tests).
10. **docs/manifest/playground touch-up** — demonstrate skin switching + catalog load in both playgrounds; ROADMAP note.
11. **full gate sweep** — all gates + size + rsc + format; commit per green round.
