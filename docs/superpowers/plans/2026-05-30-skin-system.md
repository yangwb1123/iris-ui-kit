# Skin System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a loadable, token-built skin system: a framework-agnostic `@iris-ui-kit/skins` package (inheritance, custom token namespaces, marketplace catalog client, FOUC boot script, persist / follow-system / live-edit runtime) plus thin React/Vue `SkinProvider`+`useSkin` adapters.

**Architecture:** All logic sinks to `@iris-ui-kit/skins` over `@iris-ui-kit/core`'s `createStore`. A `Skin` (partial, composable) resolves to a `ResolvedSkin` whose `.theme` is a complete `IrisTheme` (drop-in for the unchanged component layer) plus a custom CSS-var bag. Pure units (validate/resolve/registry/render/boot/storage-memory) take no DOM/network; effectful units (applySkin/loadSkin/catalog) isolate side-effects with injectable `fetch`. The DOM-write path is shared with the theme layer via a new `applyCssVars` extracted from `applyTheme`. React/Vue adapters are pure bridges mirroring `ThemeProvider`/`useTheme`.

**Tech Stack:** TypeScript (ES2022), pnpm 9 workspaces + Turborepo 2, tsup (ESM+CJS+dts), Vitest + jsdom + @testing-library/react + @vue/test-utils. No semicolons, single quotes, printWidth 100, 2-space, trailingComma all.

**Spec:** `docs/superpowers/specs/2026-05-30-skin-system-design.md`

**Quality gates (every commit must keep green):** `pnpm turbo run test typecheck lint build` + `pnpm size` + `pnpm check:rsc` + `pnpm format:check`.

**Upstream facts already verified:**

- `@iris-ui-kit/tokens` exports `COLOR_TOKENS, SPACING_TOKENS, RADII_TOKENS, ALL_TOKEN_NAMES`, types `ColorToken/SpacingToken/RadiusToken/AnyToken`, `IrisTheme*`, and `lightTheme` / `darkTheme` (names `'iris-light'` / `'iris-dark'` — so builtin skin **ids must be set explicitly** to `'light'`/`'dark'`).
- `@iris-ui-kit/theme` exports `toCssVarName`, `getCssVar`, `applyTheme`, `injectGlobalStyles`, `watchColorScheme`, `getColorScheme`, `createThemeStore`.
- `@iris-ui-kit/core` exports `createStore`/`Store<T>`.
- React: `useStore(store)` at `packages/react/src/useStore.ts`; tsup auto-discovers `src/<dir>/index.ts` as subpath entries and injects `'use client'` into every dist file in `onSuccess`. Vue tsup does the same auto-discovery. So adding `src/skins/index.ts` to each adapter auto-creates `@iris-ui-kit/{react,vue}/skins`.
- `pnpm size` budgets live in `scripts/check-size.mjs` `BUDGETS` map (must add `skins`).

---

## File Structure

```
packages/theme/src/
  applyCssVars.ts          NEW  shared DOM-write of [name,value][] → {revert()}
  applyTheme.ts            EDIT delegates to applyCssVars (behavior unchanged)
  index.ts                 EDIT export applyCssVars + type
  applyCssVars.test.ts     NEW

packages/skins/            NEW PACKAGE @iris-ui-kit/skins
  package.json tsup.config.ts tsconfig.json vitest.config.ts
  src/
    index.ts               barrel
    types.ts               Skin, ResolvedSkin, SkinManifest(Entry), SkinMode, SkinStorage, SkinTokenOverrides
    errors.ts              SkinError, skinError(), SkinResolutionError
    validateSkin.ts        pure
    resolveSkin.ts         pure (extends merge, cycle/missing/incomplete)
    registry.ts            createSkinRegistry
    builtins.ts            lightSkin/darkSkin/builtinSkins from tokens
    renderSkinStyle.ts     skinToCssEntries + renderSkinStyle (pure)
    bootScript.ts          skinBootScript (pure string)
    storage.ts             localStorageSkinStorage + memorySkinStorage
    applySkin.ts           effectful DOM apply via applyCssVars
    loadSkin.ts            effectful URL/JSON → validated Skin
    catalog.ts             createSkinCatalog (manifest client, cached)
    engine.ts              createSkinEngine orchestrator
    *.test.ts

packages/react/src/skins/  NEW  SkinProvider.tsx useSkin.ts index.ts *.test.tsx
packages/react/src/index.ts EDIT re-export ./skins
packages/react/package.json EDIT add @iris-ui-kit/skins dep
packages/react/tsup.config.ts EDIT add @iris-ui-kit/skins external

packages/vue/src/skins/    NEW  SkinProvider.ts useSkin.ts index.ts *.test.ts
packages/vue/src/index.ts  EDIT re-export ./skins
packages/vue/package.json  EDIT add @iris-ui-kit/skins dep
packages/vue/tsup.config.ts EDIT add @iris-ui-kit/skins external

scripts/check-size.mjs     EDIT add skins budget
ROADMAP.md                 EDIT note skin system
```

---

## Task 1: Extract `applyCssVars` in `@iris-ui-kit/theme` (enabling refactor)

**Files:**

- Create: `packages/theme/src/applyCssVars.ts`
- Create: `packages/theme/src/applyCssVars.test.ts`
- Modify: `packages/theme/src/applyTheme.ts`
- Modify: `packages/theme/src/index.ts`

- [ ] **Step 1: Write the failing test** — `packages/theme/src/applyCssVars.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { applyCssVars } from './applyCssVars'

describe('applyCssVars', () => {
  it('writes entries as inline custom properties', () => {
    const el = document.createElement('div')
    applyCssVars(
      [
        ['--iris-background', '#fff'],
        ['--iris-gap-md', '8px'],
      ],
      el,
    )
    expect(el.style.getPropertyValue('--iris-background')).toBe('#fff')
    expect(el.style.getPropertyValue('--iris-gap-md')).toBe('8px')
  })

  it('revert() restores prior values and removes previously-unset ones', () => {
    const el = document.createElement('div')
    el.style.setProperty('--iris-background', '#000')
    const applied = applyCssVars(
      [
        ['--iris-background', '#fff'],
        ['--iris-accent', 'red'],
      ],
      el,
    )
    applied.revert()
    expect(el.style.getPropertyValue('--iris-background')).toBe('#000')
    expect(el.style.getPropertyValue('--iris-accent')).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @iris-ui-kit/theme test -- applyCssVars`
Expected: FAIL — cannot resolve `./applyCssVars`.

- [ ] **Step 3: Implement** — `packages/theme/src/applyCssVars.ts`

```ts
export type CssVarEntries = Array<[string, string]>

export interface ApplyCssVarsResult {
  /** Restore the previously set inline custom property values on `target`. */
  revert(): void
}

/**
 * Write `[cssVarName, value]` pairs to a target element as inline custom
 * properties, returning a `revert()` that restores the prior values (removing
 * the ones that were previously unset). Pure DOM, no framework dependency —
 * the single write-path shared by `applyTheme` and `@iris-ui-kit/skins`' `applySkin`.
 */
export function applyCssVars(entries: CssVarEntries, target: HTMLElement): ApplyCssVarsResult {
  const previous: CssVarEntries = []
  for (const [name, value] of entries) {
    previous.push([name, target.style.getPropertyValue(name)])
    target.style.setProperty(name, value)
  }
  return {
    revert() {
      for (const [name, value] of previous) {
        if (value === '') target.style.removeProperty(name)
        else target.style.setProperty(name, value)
      }
    },
  }
}
```

- [ ] **Step 4: Refactor `applyTheme.ts` to delegate** (behavior unchanged)

```ts
import type { IrisTheme } from '@iris-ui-kit/tokens'
import { toCssVarName } from './toCssVarName'
import { applyCssVars, type CssVarEntries } from './applyCssVars'

export interface ApplyThemeResult {
  /** Restore the previously set inline custom property values on `target`. */
  revert(): void
}

function collectEntries(theme: IrisTheme): CssVarEntries {
  const out: CssVarEntries = []
  for (const [key, value] of Object.entries(theme.colors)) out.push([toCssVarName(key), value])
  for (const [key, value] of Object.entries(theme.spacing))
    out.push([toCssVarName(key), `${value}px`])
  for (const [key, value] of Object.entries(theme.radii))
    out.push([toCssVarName(key), `${value}px`])
  return out
}

/**
 * Write a theme to the target element as inline CSS custom properties.
 * Returns a `revert()` that restores prior values. Pure DOM, no framework
 * dependency. Delegates the var write to `applyCssVars`.
 */
export function applyTheme(
  theme: IrisTheme,
  target: HTMLElement = document.documentElement,
): ApplyThemeResult {
  const applied = applyCssVars(collectEntries(theme), target)
  const prevThemeName = target.getAttribute('data-iris-theme')
  const prevThemeType = target.getAttribute('data-iris-theme-type')
  target.setAttribute('data-iris-theme', theme.name)
  target.setAttribute('data-iris-theme-type', theme.type)
  return {
    revert() {
      applied.revert()
      if (prevThemeName === null) target.removeAttribute('data-iris-theme')
      else target.setAttribute('data-iris-theme', prevThemeName)
      if (prevThemeType === null) target.removeAttribute('data-iris-theme-type')
      else target.setAttribute('data-iris-theme-type', prevThemeType)
    },
  }
}
```

- [ ] **Step 5: Export from `index.ts`** — add after the `applyTheme` export line:

```ts
export { applyCssVars, type CssVarEntries, type ApplyCssVarsResult } from './applyCssVars'
```

- [ ] **Step 6: Run theme tests (new + regression)**

Run: `pnpm --filter @iris-ui-kit/theme test`
Expected: PASS — new `applyCssVars` tests + unchanged `applyTheme.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add packages/theme/src/applyCssVars.ts packages/theme/src/applyCssVars.test.ts packages/theme/src/applyTheme.ts packages/theme/src/index.ts
git commit -m "refactor(theme): extract applyCssVars as shared DOM-write path"
```

---

## Task 2: Scaffold `@iris-ui-kit/skins` package + types + errors

**Files:**

- Create: `packages/skins/package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
- Create: `packages/skins/src/types.ts`, `packages/skins/src/errors.ts`, `packages/skins/src/index.ts`

- [ ] **Step 1: `packages/skins/package.json`**

```json
{
  "name": "@iris-ui-kit/skins",
  "version": "0.0.0",
  "description": "Loadable, token-built skin system for Iris UI: inheritance, custom tokens, marketplace catalog, runtime engine",
  "license": "MIT",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./*": {
      "types": "./dist/*.d.ts",
      "import": "./dist/*.js",
      "require": "./dist/*.cjs"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist"],
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@iris-ui-kit/core": "workspace:*",
    "@iris-ui-kit/tokens": "workspace:*",
    "@iris-ui-kit/theme": "workspace:*"
  }
}
```

- [ ] **Step 2: `packages/skins/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules", "**/*.test.ts"]
}
```

- [ ] **Step 3: `packages/skins/tsup.config.ts`**

```ts
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: 'es2022',
  external: ['@iris-ui-kit/core', '@iris-ui-kit/tokens', '@iris-ui-kit/theme'],
})
```

- [ ] **Step 4: `packages/skins/vitest.config.ts`** (jsdom — package mixes pure + DOM tests)

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
  },
})
```

- [ ] **Step 5: `packages/skins/src/types.ts`**

```ts
import type {
  IrisTheme,
  IrisThemeType,
  IrisThemeColors,
  IrisThemeSpacing,
  IrisThemeRadii,
} from '@iris-ui-kit/tokens'

/** Partial overrides of the 21 closed core tokens. Colors are strings; spacing/radii numbers. */
export type SkinTokenOverrides = Partial<IrisThemeColors & IrisThemeSpacing & IrisThemeRadii>

/** Authoring shape: partial + composable. Resolves to a complete `ResolvedSkin`. */
export interface Skin {
  id: string
  name?: string
  version?: string
  type?: IrisThemeType
  extends?: string | string[]
  tokens?: SkinTokenOverrides
  custom?: Record<string, string | number>
  variants?: { light?: string; dark?: string }
  icons?: string
  iconOverrides?: Record<string, string>
  meta?: Record<string, unknown>
}

/** Runtime shape: fully specified. `.theme` is a complete drop-in `IrisTheme`. */
export interface ResolvedSkin {
  id: string
  name: string
  type: IrisThemeType
  theme: IrisTheme
  custom: Record<string, string | number>
  lineage: string[]
  variants?: { light?: string; dark?: string }
  source: Skin
}

export interface SkinManifestEntry {
  id: string
  name?: string
  version?: string
  type?: IrisThemeType
  /** Where to fetch the full Skin JSON. Relative to the manifest URL or absolute. */
  url: string
  meta?: Record<string, unknown>
}

export interface SkinManifest {
  schema: 1
  skins: SkinManifestEntry[]
}

export type SkinMode = 'fixed' | 'system'

export interface SkinStorage {
  get(): string | null
  set(id: string): void
  remove(): void
}
```

- [ ] **Step 6: `packages/skins/src/errors.ts`**

```ts
export type SkinErrorCode =
  | 'validate'
  | 'cycle'
  | 'missing-parent'
  | 'incomplete'
  | 'load'
  | 'catalog'

export interface SkinError {
  code: SkinErrorCode
  message: string
  id?: string
  keys?: string[]
}

export function skinError(
  code: SkinErrorCode,
  message: string,
  extra?: { id?: string; keys?: string[] },
): SkinError {
  return { code, message, ...extra }
}

/**
 * Throwable wrapper carrying a typed `SkinError`. `resolveSkin` throws this
 * (callers always wrap); effectful units reject with it. Engines catch it and
 * surface `.error` via `errors()` — never letting it reach a store subscriber.
 */
export class SkinResolutionError extends Error {
  readonly error: SkinError
  constructor(error: SkinError) {
    super(error.message)
    this.name = 'SkinResolutionError'
    this.error = error
  }
}
```

- [ ] **Step 7: `packages/skins/src/index.ts`** (initial barrel — extended in later tasks)

```ts
export type {
  Skin,
  ResolvedSkin,
  SkinTokenOverrides,
  SkinManifest,
  SkinManifestEntry,
  SkinMode,
  SkinStorage,
} from './types'
export { skinError, SkinResolutionError, type SkinError, type SkinErrorCode } from './errors'
```

- [ ] **Step 8: Install workspace link + typecheck**

Run: `pnpm install`
Then: `pnpm --filter @iris-ui-kit/skins typecheck`
Expected: PASS (no type errors).

- [ ] **Step 9: Commit**

```bash
git add packages/skins pnpm-lock.yaml
git commit -m "feat(skins): scaffold @iris-ui-kit/skins package with types + error model"
```

---

## Task 3: `validateSkin` (pure)

**Files:**

- Create: `packages/skins/src/validateSkin.ts`, `packages/skins/src/validateSkin.test.ts`
- Modify: `packages/skins/src/index.ts`

- [ ] **Step 1: Failing test** — `validateSkin.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { validateSkin } from './validateSkin'
import type { Skin } from './types'

describe('validateSkin', () => {
  it('accepts a minimal valid skin', () => {
    expect(validateSkin({ id: 'ok' })).toEqual([])
  })

  it('rejects empty id', () => {
    const errs = validateSkin({ id: '' } as Skin)
    expect(errs.some((e) => e.code === 'validate')).toBe(true)
  })

  it('rejects an unknown core token key', () => {
    const errs = validateSkin({ id: 'x', tokens: { 'iris.primaryy': '#000' } as never })
    expect(errs.some((e) => e.keys?.includes('iris.primaryy'))).toBe(true)
  })

  it('rejects a non-string color token value', () => {
    const errs = validateSkin({ id: 'x', tokens: { 'iris.primary': 5 as never } })
    expect(errs.some((e) => e.keys?.includes('iris.primary'))).toBe(true)
  })

  it('rejects a non-number spacing token value', () => {
    const errs = validateSkin({ id: 'x', tokens: { 'iris.gap.md': '8' as never } })
    expect(errs.some((e) => e.keys?.includes('iris.gap.md'))).toBe(true)
  })

  it('accepts custom tokens with string or number values', () => {
    expect(
      validateSkin({ id: 'x', custom: { 'iris.shadow.card': '0 1px 2px #000', 'brand.z': 10 } }),
    ).toEqual([])
  })

  it('rejects an invalid custom token key', () => {
    const errs = validateSkin({ id: 'x', custom: { '': 'v' } })
    expect(errs.some((e) => e.code === 'validate')).toBe(true)
  })

  it('rejects non-string extends entries', () => {
    const errs = validateSkin({ id: 'x', extends: [5 as never] })
    expect(errs.some((e) => e.code === 'validate')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify fail** — `pnpm --filter @iris-ui-kit/skins test -- validateSkin` → FAIL (module missing).

- [ ] **Step 3: Implement** — `validateSkin.ts`

```ts
import { COLOR_TOKENS, SPACING_TOKENS, RADII_TOKENS } from '@iris-ui-kit/tokens'
import type { Skin } from './types'
import { skinError, type SkinError } from './errors'

const COLOR_SET = new Set<string>(COLOR_TOKENS)
const DIMENSION_SET = new Set<string>([...SPACING_TOKENS, ...RADII_TOKENS])
const CORE_SET = new Set<string>([...COLOR_TOKENS, ...SPACING_TOKENS, ...RADII_TOKENS])
const DOT_KEY = /^[a-zA-Z][\w-]*(\.[a-zA-Z][\w-]*)*$/

/** Pure shape/type/key validation. Returns errors (empty = valid). Never throws. */
export function validateSkin(skin: Skin): SkinError[] {
  const errors: SkinError[] = []
  const id = skin?.id
  if (typeof id !== 'string' || id.length === 0) {
    errors.push(skinError('validate', 'skin.id must be a non-empty string'))
  }
  if (skin.type !== undefined && skin.type !== 'light' && skin.type !== 'dark') {
    errors.push(skinError('validate', "skin.type must be 'light' or 'dark'", { id }))
  }
  if (skin.extends !== undefined) {
    const parents = Array.isArray(skin.extends) ? skin.extends : [skin.extends]
    for (const p of parents) {
      if (typeof p !== 'string' || p.length === 0) {
        errors.push(skinError('validate', 'skin.extends entries must be non-empty strings', { id }))
      }
    }
  }
  if (skin.tokens !== undefined) {
    for (const [key, value] of Object.entries(skin.tokens)) {
      if (!CORE_SET.has(key)) {
        errors.push(
          skinError('validate', `unknown core token "${key}" (use custom for extra tokens)`, {
            id,
            keys: [key],
          }),
        )
        continue
      }
      if (COLOR_SET.has(key) && typeof value !== 'string') {
        errors.push(
          skinError('validate', `color token "${key}" must be a string`, { id, keys: [key] }),
        )
      } else if (DIMENSION_SET.has(key) && typeof value !== 'number') {
        errors.push(
          skinError('validate', `dimension token "${key}" must be a number`, { id, keys: [key] }),
        )
      }
    }
  }
  if (skin.custom !== undefined) {
    for (const [key, value] of Object.entries(skin.custom)) {
      if (!DOT_KEY.test(key)) {
        errors.push(
          skinError('validate', `custom token key "${key}" is not valid dot-notation`, {
            id,
            keys: [key],
          }),
        )
      }
      if (typeof value !== 'string' && typeof value !== 'number') {
        errors.push(
          skinError('validate', `custom token "${key}" must be a string or number`, {
            id,
            keys: [key],
          }),
        )
      }
    }
  }
  if (skin.variants !== undefined) {
    for (const k of ['light', 'dark'] as const) {
      const v = skin.variants[k]
      if (v !== undefined && (typeof v !== 'string' || v.length === 0)) {
        errors.push(skinError('validate', `variants.${k} must be a non-empty string`, { id }))
      }
    }
  }
  return errors
}
```

- [ ] **Step 4: Export from barrel** — add to `index.ts`: `export { validateSkin } from './validateSkin'`

- [ ] **Step 5: Run** — `pnpm --filter @iris-ui-kit/skins test -- validateSkin` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/skins/src/validateSkin.ts packages/skins/src/validateSkin.test.ts packages/skins/src/index.ts
git commit -m "feat(skins): add pure validateSkin"
```

---

## Task 4: `resolveSkin` + `createSkinRegistry` + `builtins` (pure)

**Files:**

- Create: `packages/skins/src/resolveSkin.ts`, `registry.ts`, `builtins.ts` + tests
- Modify: `packages/skins/src/index.ts`

- [ ] **Step 1: Failing test** — `resolveSkin.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { lightTheme, darkTheme } from '@iris-ui-kit/tokens'
import { resolveSkin, type SkinLookup } from './resolveSkin'
import { SkinResolutionError } from './errors'
import type { Skin } from './types'

function lookup(skins: Skin[]): SkinLookup {
  const map = new Map(skins.map((s) => [s.id, s]))
  return { get: (id) => map.get(id) }
}

const base: Skin = {
  id: 'base',
  type: 'light',
  tokens: { ...lightTheme.colors, ...lightTheme.spacing, ...lightTheme.radii },
}

describe('resolveSkin', () => {
  it('resolves a complete skin to a full IrisTheme', () => {
    const r = resolveSkin(base, lookup([base]))
    expect(r.theme.colors['iris.primary']).toBe(lightTheme.colors['iris.primary'])
    expect(r.lineage).toEqual(['base'])
    expect(r.type).toBe('light')
  })

  it('merges extends base→leaf, child wins', () => {
    const child: Skin = {
      id: 'child',
      extends: 'base',
      type: 'dark',
      tokens: { 'iris.primary': '#abcdef' },
      custom: { 'brand.x': 4 },
    }
    const r = resolveSkin(child, lookup([base, child]))
    expect(r.theme.colors['iris.primary']).toBe('#abcdef')
    expect(r.theme.colors['iris.background']).toBe(lightTheme.colors['iris.background'])
    expect(r.type).toBe('dark')
    expect(r.custom['brand.x']).toBe(4)
    expect(r.lineage).toEqual(['base', 'child'])
  })

  it('throws incomplete when a core token is missing', () => {
    const partial: Skin = { id: 'p', tokens: { 'iris.primary': '#000' } }
    expect(() => resolveSkin(partial, lookup([partial]))).toThrowError(SkinResolutionError)
  })

  it('throws missing-parent for an unknown extends id', () => {
    const child: Skin = { id: 'c', extends: 'ghost' }
    try {
      resolveSkin(child, lookup([child]))
      expect.unreachable()
    } catch (e) {
      expect((e as SkinResolutionError).error.code).toBe('missing-parent')
    }
  })

  it('detects cycles', () => {
    const a: Skin = { id: 'a', extends: 'b' }
    const b: Skin = { id: 'b', extends: 'a' }
    try {
      resolveSkin(a, lookup([a, b]))
      expect.unreachable()
    } catch (e) {
      expect((e as SkinResolutionError).error.code).toBe('cycle')
    }
  })
})
```

- [ ] **Step 2: Run to verify fail** — module missing.

- [ ] **Step 3: Implement** — `resolveSkin.ts`

```ts
import { COLOR_TOKENS, SPACING_TOKENS, RADII_TOKENS } from '@iris-ui-kit/tokens'
import type {
  IrisTheme,
  IrisThemeType,
  ColorToken,
  SpacingToken,
  RadiusToken,
} from '@iris-ui-kit/tokens'
import type { Skin, ResolvedSkin } from './types'
import { skinError, SkinResolutionError } from './errors'

export interface SkinLookup {
  get(id: string): Skin | undefined
}

/**
 * Resolve a skin's `extends` chain (base→leaf, child wins) into a complete
 * `ResolvedSkin`. Pure. Throws `SkinResolutionError` on cycle / missing parent
 * / incompleteness — callers (registry, engine) always wrap.
 */
export function resolveSkin(skin: Skin, registry: SkinLookup): ResolvedSkin {
  const lineage: string[] = []
  const tokens: Record<string, string | number> = {}
  const custom: Record<string, string | number> = {}
  let type: IrisThemeType | undefined
  let icons: string | undefined
  let iconOverrides: Record<string, string> | undefined
  let variants: { light?: string; dark?: string } | undefined
  const path = new Set<string>()

  function walk(node: Skin): void {
    if (path.has(node.id)) {
      throw new SkinResolutionError(
        skinError('cycle', `cycle detected at skin "${node.id}"`, { id: node.id }),
      )
    }
    path.add(node.id)
    const parents =
      node.extends === undefined ? [] : Array.isArray(node.extends) ? node.extends : [node.extends]
    for (const pid of parents) {
      const parent = registry.get(pid)
      if (!parent) {
        throw new SkinResolutionError(
          skinError('missing-parent', `skin "${node.id}" extends unknown "${pid}"`, {
            id: node.id,
          }),
        )
      }
      walk(parent)
    }
    if (!lineage.includes(node.id)) lineage.push(node.id)
    if (node.tokens) Object.assign(tokens, node.tokens)
    if (node.custom) Object.assign(custom, node.custom)
    if (node.type !== undefined) type = node.type
    if (node.icons !== undefined) icons = node.icons
    if (node.iconOverrides !== undefined) iconOverrides = node.iconOverrides
    if (node.variants !== undefined) variants = node.variants
    path.delete(node.id)
  }

  walk(skin)

  const missing: string[] = []
  const colors = {} as Record<ColorToken, string>
  const spacing = {} as Record<SpacingToken, number>
  const radii = {} as Record<RadiusToken, number>
  for (const key of COLOR_TOKENS) {
    const v = tokens[key]
    if (typeof v !== 'string') missing.push(key)
    else colors[key] = v
  }
  for (const key of SPACING_TOKENS) {
    const v = tokens[key]
    if (typeof v !== 'number') missing.push(key)
    else spacing[key] = v
  }
  for (const key of RADII_TOKENS) {
    const v = tokens[key]
    if (typeof v !== 'number') missing.push(key)
    else radii[key] = v
  }
  if (missing.length > 0) {
    throw new SkinResolutionError(
      skinError('incomplete', `skin "${skin.id}" missing tokens: ${missing.join(', ')}`, {
        id: skin.id,
        keys: missing,
      }),
    )
  }

  const resolvedType: IrisThemeType = type ?? 'light'
  const theme: IrisTheme = {
    name: skin.id,
    type: resolvedType,
    colors,
    spacing,
    radii,
    ...(icons !== undefined ? { icons } : {}),
    ...(iconOverrides !== undefined ? { iconOverrides } : {}),
  }
  return {
    id: skin.id,
    name: skin.name ?? skin.id,
    type: resolvedType,
    theme,
    custom,
    lineage,
    ...(variants !== undefined ? { variants } : {}),
    source: skin,
  }
}
```

- [ ] **Step 4: Implement** — `builtins.ts`

```ts
import { lightTheme, darkTheme, type IrisTheme } from '@iris-ui-kit/tokens'
import type { Skin } from './types'

function themeToSkin(id: string, theme: IrisTheme): Skin {
  return {
    id,
    name: theme.name,
    type: theme.type,
    tokens: { ...theme.colors, ...theme.spacing, ...theme.radii },
    ...(theme.icons !== undefined ? { icons: theme.icons } : {}),
    ...(theme.iconOverrides !== undefined ? { iconOverrides: theme.iconOverrides } : {}),
  }
}

/** Built-in base skins. Ids are the stable `'light'` / `'dark'` (theme names differ). */
export const lightSkin: Skin = themeToSkin('light', lightTheme)
export const darkSkin: Skin = themeToSkin('dark', darkTheme)
export const builtinSkins: Skin[] = [lightSkin, darkSkin]
```

- [ ] **Step 5: Implement** — `registry.ts`

```ts
import type { Skin, ResolvedSkin } from './types'
import { validateSkin } from './validateSkin'
import { resolveSkin } from './resolveSkin'
import { skinError, SkinResolutionError, type SkinError } from './errors'

export interface SkinRegistry {
  /** Validate then register (only if valid). Returns validation errors (empty = registered). */
  register(skin: Skin): SkinError[]
  get(id: string): Skin | undefined
  has(id: string): boolean
  list(): Skin[]
  remove(id: string): boolean
  /** Resolve a registered skin's extends-chain. Throws `SkinResolutionError` if absent/invalid. */
  resolve(id: string): ResolvedSkin
}

export function createSkinRegistry(initial: Skin[] = []): SkinRegistry {
  const map = new Map<string, Skin>()
  const registry: SkinRegistry = {
    register(skin) {
      const errors = validateSkin(skin)
      if (errors.length === 0) map.set(skin.id, skin)
      return errors
    },
    get: (id) => map.get(id),
    has: (id) => map.has(id),
    list: () => [...map.values()],
    remove: (id) => map.delete(id),
    resolve(id) {
      const skin = map.get(id)
      if (!skin) {
        throw new SkinResolutionError(skinError('missing-parent', `unknown skin "${id}"`, { id }))
      }
      return resolveSkin(skin, registry)
    },
  }
  for (const s of initial) registry.register(s)
  return registry
}
```

- [ ] **Step 6: `registry.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { createSkinRegistry } from './registry'
import { builtinSkins } from './builtins'

describe('createSkinRegistry', () => {
  it('registers builtin light/dark and resolves them complete', () => {
    const reg = createSkinRegistry(builtinSkins)
    expect(reg.has('light')).toBe(true)
    expect(reg.has('dark')).toBe(true)
    const dark = reg.resolve('dark')
    expect(dark.type).toBe('dark')
    expect(Object.keys(dark.theme.colors).length).toBe(12)
  })

  it('resolves a partial skin that extends a builtin', () => {
    const reg = createSkinRegistry(builtinSkins)
    expect(
      reg.register({ id: 'brand', extends: 'dark', tokens: { 'iris.primary': '#ff0' } }),
    ).toEqual([])
    const r = reg.resolve('brand')
    expect(r.theme.colors['iris.primary']).toBe('#ff0')
    expect(r.lineage).toEqual(['dark', 'brand'])
  })

  it('does not register an invalid skin', () => {
    const reg = createSkinRegistry()
    const errs = reg.register({ id: '' })
    expect(errs.length).toBeGreaterThan(0)
    expect(reg.list().length).toBe(0)
  })
})
```

- [ ] **Step 7: Export from barrel** — add to `index.ts`:

```ts
export { resolveSkin, type SkinLookup } from './resolveSkin'
export { createSkinRegistry, type SkinRegistry } from './registry'
export { lightSkin, darkSkin, builtinSkins } from './builtins'
```

- [ ] **Step 8: Run** — `pnpm --filter @iris-ui-kit/skins test` → all pure tests PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/skins/src/resolveSkin.ts packages/skins/src/resolveSkin.test.ts packages/skins/src/registry.ts packages/skins/src/registry.test.ts packages/skins/src/builtins.ts packages/skins/src/index.ts
git commit -m "feat(skins): add resolveSkin, registry, and builtin base skins"
```

---

## Task 5: `renderSkinStyle` + `bootScript` + `storage` (pure / SSR-safe)

**Files:**

- Create: `packages/skins/src/renderSkinStyle.ts`, `bootScript.ts`, `storage.ts` + tests
- Modify: `packages/skins/src/index.ts`

- [ ] **Step 1: Failing tests** — `renderSkinStyle.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { createSkinRegistry } from './registry'
import { builtinSkins } from './builtins'
import { renderSkinStyle, skinToCssEntries } from './renderSkinStyle'

describe('renderSkinStyle', () => {
  const reg = createSkinRegistry(builtinSkins)

  it('emits :root CSS with --iris- vars', () => {
    const css = renderSkinStyle(reg.resolve('light'))
    expect(css.startsWith(':root{')).toBe(true)
    expect(css).toContain('--iris-primary:')
    expect(css.endsWith('}')).toBe(true)
  })

  it('serializes custom tokens, numbers as px', () => {
    reg.register({ id: 'c', extends: 'light', custom: { 'brand.gap': 12, 'brand.font': 'Inter' } })
    const entries = skinToCssEntries(reg.resolve('c'))
    expect(entries).toContainEqual(['--brand-gap', '12px'])
    expect(entries).toContainEqual(['--brand-font', 'Inter'])
  })
})
```

`storage.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { memorySkinStorage, localStorageSkinStorage } from './storage'

describe('memorySkinStorage', () => {
  it('round-trips and clears', () => {
    const s = memorySkinStorage()
    expect(s.get()).toBeNull()
    s.set('x')
    expect(s.get()).toBe('x')
    s.remove()
    expect(s.get()).toBeNull()
  })
})

describe('localStorageSkinStorage', () => {
  it('round-trips via window.localStorage (jsdom)', () => {
    const s = localStorageSkinStorage('iris-skin-test')
    s.set('ocean')
    expect(s.get()).toBe('ocean')
    s.remove()
    expect(s.get()).toBeNull()
  })
})
```

`bootScript.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { skinBootScript } from './bootScript'

describe('skinBootScript', () => {
  it('returns an IIFE string embedding the styles + fallback', () => {
    const script = skinBootScript({
      storageKey: 'iris-skin',
      styles: { light: ':root{--iris-primary:#000}' },
      fallbackId: 'light',
    })
    expect(script).toContain('iris-skin')
    expect(script).toContain('--iris-primary')
    expect(script).toContain('localStorage')
    expect(script.trim().startsWith('(function')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify fail** — modules missing.

- [ ] **Step 3: Implement** — `renderSkinStyle.ts`

```ts
import { toCssVarName } from '@iris-ui-kit/theme'
import type { ResolvedSkin } from './types'

/** All CSS-var entries for a resolved skin: core theme tokens + custom tokens (numbers → px). */
export function skinToCssEntries(resolved: ResolvedSkin): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const [k, v] of Object.entries(resolved.theme.colors)) out.push([toCssVarName(k), v])
  for (const [k, v] of Object.entries(resolved.theme.spacing)) out.push([toCssVarName(k), `${v}px`])
  for (const [k, v] of Object.entries(resolved.theme.radii)) out.push([toCssVarName(k), `${v}px`])
  for (const [k, v] of Object.entries(resolved.custom)) {
    out.push([toCssVarName(k), typeof v === 'number' ? `${v}px` : v])
  }
  return out
}

/** Render a resolved skin as a CSS rule string. Pure — safe on the server (SSR/FOUC). */
export function renderSkinStyle(resolved: ResolvedSkin, selector = ':root'): string {
  const body = skinToCssEntries(resolved)
    .map(([n, v]) => `${n}:${v}`)
    .join(';')
  return `${selector}{${body}}`
}
```

- [ ] **Step 4: Implement** — `storage.ts`

```ts
import type { SkinStorage } from './types'

/**
 * Persist the selected skin id in `localStorage`. SSR-safe: every method is a
 * no-op when `window`/`localStorage` is unavailable or throws (private mode).
 */
export function localStorageSkinStorage(key = 'iris-skin'): SkinStorage {
  function store(): Storage | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) return null
      return window.localStorage
    } catch {
      return null
    }
  }
  return {
    get: () => store()?.getItem(key) ?? null,
    set: (id) => store()?.setItem(key, id),
    remove: () => store()?.removeItem(key),
  }
}

/** In-memory storage for tests / SSR. */
export function memorySkinStorage(initial: string | null = null): SkinStorage {
  let value = initial
  return {
    get: () => value,
    set: (id) => {
      value = id
    },
    remove: () => {
      value = null
    },
  }
}
```

- [ ] **Step 5: Implement** — `bootScript.ts`

```ts
export interface SkinBootScriptConfig {
  storageKey?: string
  /** Pre-serialized CSS per skin id (from `renderSkinStyle` with `':root'`). */
  styles: Record<string, string>
  /** Fallback skin id when storage is empty / unknown. */
  fallbackId: string
  /** Map system light/dark → skin id when the stored value is `'system'`. */
  systemMap?: { light: string; dark: string }
}

/**
 * Build a self-contained inline `<script>` body (a string) the host injects in
 * `<head>` before first paint to eliminate FOUC / hydration flash. At runtime
 * it reads the persisted id (or system preference), looks up the pre-serialized
 * CSS, and appends a `<style>` via `textContent` (never innerHTML). Ships only
 * strings — no resolver logic — so it stays tiny.
 */
export function skinBootScript(config: SkinBootScriptConfig): string {
  const payload = JSON.stringify({
    key: config.storageKey ?? 'iris-skin',
    styles: config.styles,
    fallbackId: config.fallbackId,
    systemMap: config.systemMap ?? null,
  })
  return (
    `(function(){var c=${payload};try{` +
    `var id=localStorage.getItem(c.key);` +
    `if((!id||id==='system')&&c.systemMap){` +
    `id=matchMedia('(prefers-color-scheme: dark)').matches?c.systemMap.dark:c.systemMap.light;}` +
    `if(!id||!c.styles[id])id=c.fallbackId;` +
    `var css=c.styles[id];if(!css)return;` +
    `var s=document.createElement('style');s.setAttribute('data-iris-skin-boot','');` +
    `s.textContent=css;document.head.appendChild(s);` +
    `document.documentElement.setAttribute('data-iris-skin',id);}catch(e){}})();`
  )
}
```

- [ ] **Step 6: Export from barrel** — add to `index.ts`:

```ts
export { renderSkinStyle, skinToCssEntries } from './renderSkinStyle'
export { skinBootScript, type SkinBootScriptConfig } from './bootScript'
export { localStorageSkinStorage, memorySkinStorage } from './storage'
```

- [ ] **Step 7: Run** — `pnpm --filter @iris-ui-kit/skins test` → PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/skins/src/renderSkinStyle.ts packages/skins/src/renderSkinStyle.test.ts packages/skins/src/storage.ts packages/skins/src/storage.test.ts packages/skins/src/bootScript.ts packages/skins/src/bootScript.test.ts packages/skins/src/index.ts
git commit -m "feat(skins): add renderSkinStyle, FOUC bootScript, and storage adapters"
```

---

## Task 6: `applySkin` (effectful DOM)

**Files:**

- Create: `packages/skins/src/applySkin.ts`, `applySkin.test.ts`
- Modify: `packages/skins/src/index.ts`

- [ ] **Step 1: Failing test** — `applySkin.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { createSkinRegistry } from './registry'
import { builtinSkins } from './builtins'
import { applySkin } from './applySkin'

describe('applySkin', () => {
  const reg = createSkinRegistry(builtinSkins)

  it('writes core + custom vars and data-attrs, reverts cleanly', () => {
    reg.register({ id: 'c', extends: 'dark', custom: { 'brand.x': 3 } })
    const el = document.createElement('div')
    const applied = applySkin(reg.resolve('c'), el)
    expect(el.style.getPropertyValue('--iris-background')).not.toBe('')
    expect(el.style.getPropertyValue('--brand-x')).toBe('3px')
    expect(el.getAttribute('data-iris-skin')).toBe('c')
    expect(el.getAttribute('data-iris-skin-type')).toBe('dark')
    applied.revert()
    expect(el.style.getPropertyValue('--brand-x')).toBe('')
    expect(el.getAttribute('data-iris-skin')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement** — `applySkin.ts`

```ts
import { applyCssVars, type ApplyCssVarsResult } from '@iris-ui-kit/theme'
import type { ResolvedSkin } from './types'
import { skinToCssEntries } from './renderSkinStyle'

export interface ApplySkinResult {
  revert(): void
}

/**
 * Apply a resolved skin to a target element as inline CSS custom properties
 * (core theme + custom tokens) plus `data-iris-skin` / `data-iris-skin-type`.
 * Reuses the theme layer's `applyCssVars`. Returns `revert()`.
 */
export function applySkin(
  resolved: ResolvedSkin,
  target: HTMLElement = document.documentElement,
): ApplySkinResult {
  const applied: ApplyCssVarsResult = applyCssVars(skinToCssEntries(resolved), target)
  const prevId = target.getAttribute('data-iris-skin')
  const prevType = target.getAttribute('data-iris-skin-type')
  target.setAttribute('data-iris-skin', resolved.id)
  target.setAttribute('data-iris-skin-type', resolved.type)
  return {
    revert() {
      applied.revert()
      if (prevId === null) target.removeAttribute('data-iris-skin')
      else target.setAttribute('data-iris-skin', prevId)
      if (prevType === null) target.removeAttribute('data-iris-skin-type')
      else target.setAttribute('data-iris-skin-type', prevType)
    },
  }
}
```

- [ ] **Step 4: Export from barrel** — `export { applySkin, type ApplySkinResult } from './applySkin'`

- [ ] **Step 5: Run** — PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/skins/src/applySkin.ts packages/skins/src/applySkin.test.ts packages/skins/src/index.ts
git commit -m "feat(skins): add applySkin DOM applicator reusing applyCssVars"
```

---

## Task 7: `loadSkin` + `createSkinCatalog` (effectful, injectable fetch)

**Files:**

- Create: `packages/skins/src/loadSkin.ts`, `catalog.ts` + tests
- Modify: `packages/skins/src/index.ts`

- [ ] **Step 1: Failing tests** — `loadSkin.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { loadSkin } from './loadSkin'
import { SkinResolutionError } from './errors'
import type { Skin } from './types'

const valid: Skin = { id: 'remote', extends: 'dark', tokens: { 'iris.primary': '#123456' } }

function fetchOf(body: unknown, ok = true, status = 200): typeof fetch {
  return (async () =>
    ({ ok, status, json: async () => body }) as Response) as unknown as typeof fetch
}

describe('loadSkin', () => {
  it('returns an inline skin object after validation', async () => {
    expect(await loadSkin(valid)).toEqual(valid)
  })

  it('fetches + validates a URL source', async () => {
    expect(await loadSkin('https://x/skin.json', { fetch: fetchOf(valid) })).toEqual(valid)
  })

  it('rejects an invalid skin', async () => {
    await expect(loadSkin({ id: '' } as Skin)).rejects.toBeInstanceOf(SkinResolutionError)
  })

  it('rejects on non-ok response', async () => {
    await expect(
      loadSkin('https://x/skin.json', { fetch: fetchOf(null, false, 404) }),
    ).rejects.toBeInstanceOf(SkinResolutionError)
  })
})
```

`catalog.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { createSkinCatalog } from './catalog'
import type { SkinManifest, Skin } from './types'

const manifest: SkinManifest = {
  schema: 1,
  skins: [
    { id: 'ocean', name: 'Ocean', url: 'ocean.json', meta: { tags: ['blue'] } },
    { id: 'sunset', name: 'Sunset', url: 'https://cdn/sunset.json' },
  ],
}
const ocean: Skin = { id: 'ocean', extends: 'dark', tokens: { 'iris.primary': '#06f' } }

function router(): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.endsWith('manifest.json'))
      return { ok: true, status: 200, json: async () => manifest } as Response
    if (url.endsWith('ocean.json'))
      return { ok: true, status: 200, json: async () => ocean } as Response
    return { ok: false, status: 404, json: async () => null } as Response
  }) as unknown as typeof fetch
}

describe('createSkinCatalog', () => {
  it('loads + lists + searches the manifest', async () => {
    const cat = createSkinCatalog({ manifestUrl: 'https://cdn/manifest.json', fetch: router() })
    await cat.load()
    expect(cat.list().map((e) => e.id)).toEqual(['ocean', 'sunset'])
    expect(cat.search('blue').map((e) => e.id)).toEqual(['ocean'])
    expect(cat.get('sunset')?.name).toBe('Sunset')
  })

  it('lazy-fetches a skin by id (resolving relative url) and caches it', async () => {
    const cat = createSkinCatalog({ manifestUrl: 'https://cdn/manifest.json', fetch: router() })
    const skin = await cat.fetchSkin('ocean')
    expect(skin.tokens?.['iris.primary']).toBe('#06f')
    expect(await cat.fetchSkin('ocean')).toBe(skin) // cached identity
  })

  it('rejects fetchSkin for an unknown id', async () => {
    const cat = createSkinCatalog({ manifestUrl: 'https://cdn/manifest.json', fetch: router() })
    await expect(cat.fetchSkin('ghost')).rejects.toBeTruthy()
  })
})
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement** — `loadSkin.ts`

```ts
import type { Skin } from './types'
import { validateSkin } from './validateSkin'
import { skinError, SkinResolutionError } from './errors'

export interface LoadSkinOptions {
  fetch?: typeof fetch
}

function resolveFetch(injected?: typeof fetch): typeof fetch {
  if (injected) return injected
  if (typeof fetch !== 'undefined') return fetch
  throw new SkinResolutionError(skinError('load', 'no fetch available to load a skin'))
}

/** Load a skin from a URL (fetch+parse) or an inline object, validating before returning. */
export async function loadSkin(source: string | Skin, opts: LoadSkinOptions = {}): Promise<Skin> {
  let skin: Skin
  if (typeof source === 'string') {
    const f = resolveFetch(opts.fetch)
    const res = await f(source)
    if (!res.ok) {
      throw new SkinResolutionError(skinError('load', `failed to fetch skin: ${res.status}`))
    }
    skin = (await res.json()) as Skin
  } else {
    skin = source
  }
  const errors = validateSkin(skin)
  if (errors.length > 0) {
    throw new SkinResolutionError(
      skinError('load', `invalid skin: ${errors.map((e) => e.message).join('; ')}`, {
        id: skin?.id,
        keys: errors.flatMap((e) => e.keys ?? []),
      }),
    )
  }
  return skin
}
```

- [ ] **Step 4: Implement** — `catalog.ts`

```ts
import type { Skin, SkinManifest, SkinManifestEntry } from './types'
import { loadSkin } from './loadSkin'
import { skinError, SkinResolutionError } from './errors'

export interface SkinCatalogConfig {
  manifestUrl: string
  fetch?: typeof fetch
}

export interface SkinCatalog {
  load(): Promise<SkinManifestEntry[]>
  list(): SkinManifestEntry[]
  search(query: string): SkinManifestEntry[]
  get(id: string): SkinManifestEntry | undefined
  fetchSkin(id: string): Promise<Skin>
}

/** Client half of the marketplace: fetch a manifest, list/search entries, lazy-fetch skins. */
export function createSkinCatalog(config: SkinCatalogConfig): SkinCatalog {
  const f = config.fetch ?? (typeof fetch !== 'undefined' ? fetch : undefined)
  let entries: SkinManifestEntry[] = []
  let loaded = false
  const cache = new Map<string, Skin>()

  function resolveUrl(url: string): string {
    try {
      return new URL(url, config.manifestUrl).toString()
    } catch {
      return url
    }
  }

  const catalog: SkinCatalog = {
    async load() {
      if (!f) throw new SkinResolutionError(skinError('catalog', 'no fetch available for catalog'))
      const res = await f(config.manifestUrl)
      if (!res.ok) {
        throw new SkinResolutionError(
          skinError('catalog', `failed to fetch manifest: ${res.status}`),
        )
      }
      const manifest = (await res.json()) as SkinManifest
      if (!manifest || manifest.schema !== 1 || !Array.isArray(manifest.skins)) {
        throw new SkinResolutionError(skinError('catalog', 'invalid skin manifest'))
      }
      entries = manifest.skins
      loaded = true
      return entries
    },
    list: () => entries,
    search(query) {
      const q = query.toLowerCase()
      return entries.filter((e) => {
        const meta = e.meta as { tags?: unknown } | undefined
        const tags = Array.isArray(meta?.tags) ? (meta.tags as string[]).join(' ') : ''
        return (
          e.id.toLowerCase().includes(q) ||
          (e.name ?? '').toLowerCase().includes(q) ||
          tags.toLowerCase().includes(q)
        )
      })
    },
    get: (id) => entries.find((e) => e.id === id),
    async fetchSkin(id) {
      const hit = cache.get(id)
      if (hit) return hit
      if (!loaded) await catalog.load()
      const entry = entries.find((e) => e.id === id)
      if (!entry) {
        throw new SkinResolutionError(skinError('catalog', `skin "${id}" not in catalog`, { id }))
      }
      const skin = await loadSkin(resolveUrl(entry.url), { fetch: f })
      cache.set(id, skin)
      return skin
    },
  }
  return catalog
}
```

- [ ] **Step 5: Export from barrel** — add:

```ts
export { loadSkin, type LoadSkinOptions } from './loadSkin'
export { createSkinCatalog, type SkinCatalog, type SkinCatalogConfig } from './catalog'
```

- [ ] **Step 6: Run** — `pnpm --filter @iris-ui-kit/skins test` → PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/skins/src/loadSkin.ts packages/skins/src/loadSkin.test.ts packages/skins/src/catalog.ts packages/skins/src/catalog.test.ts packages/skins/src/index.ts
git commit -m "feat(skins): add loadSkin + marketplace catalog client (injectable fetch)"
```

---

## Task 8: `createSkinEngine` (orchestrator: persist, system-follow, live-edit, catalog)

**Files:**

- Create: `packages/skins/src/engine.ts`, `engine.test.ts`
- Modify: `packages/skins/src/index.ts`

- [ ] **Step 1: Failing test** — `engine.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSkinEngine } from './engine'
import { memorySkinStorage } from './storage'
import type { Skin } from './types'

const brand: Skin = {
  id: 'brand',
  extends: 'dark',
  tokens: { 'iris.primary': '#abc' },
  variants: { light: 'light', dark: 'dark' },
}

describe('createSkinEngine', () => {
  it('initializes to default and switches skins', () => {
    const engine = createSkinEngine({ skins: [brand], default: 'light' })
    expect(engine.current().id).toBe('light')
    engine.setSkin('brand')
    expect(engine.current().id).toBe('brand')
    expect(engine.current().theme.colors['iris.primary']).toBe('#abc')
  })

  it('persists selection through storage and restores it', () => {
    const storage = memorySkinStorage()
    const a = createSkinEngine({ skins: [brand], default: 'light', storage })
    a.setSkin('brand')
    expect(storage.get()).toBe('brand')
    const b = createSkinEngine({ skins: [brand], default: 'light', storage })
    expect(b.current().id).toBe('brand')
  })

  it('falls back to default when stored skin is unknown, recording an error', () => {
    const storage = memorySkinStorage('ghost')
    const engine = createSkinEngine({ skins: [brand], default: 'light', storage })
    expect(engine.current().id).toBe('light')
    expect(engine.errors().length).toBeGreaterThan(0)
  })

  it('loadSkin registers + applies an inline skin', async () => {
    const engine = createSkinEngine({ default: 'light' })
    const r = await engine.loadSkin({
      id: 'inline',
      extends: 'light',
      tokens: { 'iris.primary': '#0f0' },
    })
    expect(r.id).toBe('inline')
    expect(engine.current().theme.colors['iris.primary']).toBe('#0f0')
  })

  it('live-edit patch overlays non-destructively; resetPatch reverts', () => {
    const engine = createSkinEngine({ skins: [brand], default: 'brand' })
    engine.patch({ tokens: { 'iris.primary': '#fff' }, custom: { 'brand.z': 9 } })
    expect(engine.current().theme.colors['iris.primary']).toBe('#fff')
    expect(engine.current().custom['brand.z']).toBe(9)
    // registry source untouched:
    expect(engine.registry.get('brand')?.tokens?.['iris.primary']).toBe('#abc')
    engine.resetPatch()
    expect(engine.current().theme.colors['iris.primary']).toBe('#abc')
  })

  it("system mode follows prefers-color-scheme via the skin's variants", () => {
    const listeners: Array<(e: { matches: boolean }) => void> = []
    let matches = false
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches,
      media: q,
      addEventListener: (_: string, cb: (e: { matches: boolean }) => void) => listeners.push(cb),
      removeEventListener: () => {},
      addListener: (cb: (e: { matches: boolean }) => void) => listeners.push(cb),
      removeListener: () => {},
    }))
    const engine = createSkinEngine({ skins: [brand], default: 'brand', mode: 'system' })
    expect(engine.current().id).toBe('light') // brand.variants.light
    matches = true
    listeners.forEach((cb) => cb({ matches: true }))
    expect(engine.current().id).toBe('dark') // brand.variants.dark
    engine.destroy()
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Run to verify fail.**

- [ ] **Step 3: Implement** — `engine.ts`

```ts
import { createStore, type Store } from '@iris-ui-kit/core'
import { watchColorScheme, getColorScheme } from '@iris-ui-kit/theme'
import type { Skin, ResolvedSkin, SkinMode, SkinStorage, SkinTokenOverrides } from './types'
import { createSkinRegistry, type SkinRegistry } from './registry'
import { builtinSkins } from './builtins'
import { loadSkin as loadSkinSource } from './loadSkin'
import type { SkinCatalog } from './catalog'
import { skinError, SkinResolutionError, type SkinError } from './errors'

export interface SkinEngineConfig {
  skins?: Skin[]
  /** Initial skin id (must resolve, or engine falls back to 'light'). */
  default: string
  catalog?: SkinCatalog
  storage?: SkinStorage
  mode?: SkinMode
}

export interface SkinPatch {
  tokens?: SkinTokenOverrides
  custom?: Record<string, string | number>
}

export interface SkinEngine {
  store: Store<ResolvedSkin>
  registry: SkinRegistry
  current(): ResolvedSkin
  availableSkins(): Skin[]
  setSkin(id: string): void
  loadSkin(source: string | Skin): Promise<ResolvedSkin>
  useFromCatalog(id: string): Promise<ResolvedSkin>
  attachCatalog(catalog: SkinCatalog): void
  setMode(mode: SkinMode): void
  getMode(): SkinMode
  patch(overrides: SkinPatch): void
  resetPatch(): void
  subscribe(listener: (skin: ResolvedSkin) => void): () => void
  destroy(): void
  errors(): SkinError[]
}

export function createSkinEngine(config: SkinEngineConfig): SkinEngine {
  const registry = createSkinRegistry([...builtinSkins, ...(config.skins ?? [])])
  const storage = config.storage
  let catalog = config.catalog
  let mode: SkinMode = config.mode ?? 'fixed'
  let activeId = storage?.get() ?? config.default
  let patchOverlay: SkinPatch | null = null
  let stopWatch: (() => void) | null = null
  const errorLog: SkinError[] = []

  function record(e: unknown): void {
    if (e instanceof SkinResolutionError) errorLog.push(e.error)
    else errorLog.push(skinError('validate', String(e)))
  }

  function applyOverlay(base: ResolvedSkin): ResolvedSkin {
    if (!patchOverlay || (!patchOverlay.tokens && !patchOverlay.custom)) return base
    const theme = {
      ...base.theme,
      colors: { ...base.theme.colors },
      spacing: { ...base.theme.spacing },
      radii: { ...base.theme.radii },
    }
    if (patchOverlay.tokens) {
      for (const [k, v] of Object.entries(patchOverlay.tokens)) {
        if (k in theme.colors && typeof v === 'string')
          (theme.colors as Record<string, string>)[k] = v
        else if (k in theme.spacing && typeof v === 'number')
          (theme.spacing as Record<string, number>)[k] = v
        else if (k in theme.radii && typeof v === 'number')
          (theme.radii as Record<string, number>)[k] = v
      }
    }
    const custom = { ...base.custom, ...(patchOverlay.custom ?? {}) }
    return { ...base, theme, custom }
  }

  /** Resolve id, applying system-variant remap + live-edit overlay; fall back safely. */
  function compute(id: string): ResolvedSkin {
    const target = remapForMode(id)
    try {
      return applyOverlay(registry.resolve(target))
    } catch (e) {
      record(e)
      try {
        return applyOverlay(registry.resolve(config.default))
      } catch (e2) {
        record(e2)
        return applyOverlay(registry.resolve('light'))
      }
    }
  }

  function remapForMode(id: string): string {
    if (mode !== 'system') return id
    const scheme = getColorScheme()
    const variants = registry.get(id)?.variants
    if (variants) return scheme === 'dark' ? (variants.dark ?? id) : (variants.light ?? id)
    return scheme === 'dark' ? 'dark' : 'light'
  }

  const store = createStore<ResolvedSkin>(compute(activeId))

  function commit(id: string): void {
    activeId = id
    store.setState(compute(id))
  }
  function refresh(): void {
    store.setState(compute(activeId))
  }
  function startWatch(): void {
    if (stopWatch) return
    stopWatch = watchColorScheme(() => refresh())
  }
  function endWatch(): void {
    stopWatch?.()
    stopWatch = null
  }
  if (mode === 'system') startWatch()

  const engine: SkinEngine = {
    store,
    registry,
    current: () => store.getState(),
    availableSkins: () => registry.list(),
    setSkin(id) {
      storage?.set(id)
      commit(id)
    },
    async loadSkin(source) {
      try {
        const skin = await loadSkinSource(source)
        const errs = registry.register(skin)
        if (errs.length) {
          errorLog.push(...errs)
          throw new SkinResolutionError(errs[0])
        }
        storage?.set(skin.id)
        commit(skin.id)
        return store.getState()
      } catch (e) {
        record(e)
        throw e
      }
    },
    async useFromCatalog(id) {
      if (!catalog) throw new SkinResolutionError(skinError('catalog', 'no catalog attached'))
      try {
        const skin = await catalog.fetchSkin(id)
        const errs = registry.register(skin)
        if (errs.length) {
          errorLog.push(...errs)
          throw new SkinResolutionError(errs[0])
        }
        storage?.set(skin.id)
        commit(skin.id)
        return store.getState()
      } catch (e) {
        record(e)
        throw e
      }
    },
    attachCatalog(c) {
      catalog = c
    },
    setMode(next) {
      mode = next
      if (next === 'system') startWatch()
      else endWatch()
      refresh()
    },
    getMode: () => mode,
    patch(overrides) {
      patchOverlay = {
        tokens: { ...(patchOverlay?.tokens ?? {}), ...(overrides.tokens ?? {}) },
        custom: { ...(patchOverlay?.custom ?? {}), ...(overrides.custom ?? {}) },
      }
      refresh()
    },
    resetPatch() {
      patchOverlay = null
      refresh()
    },
    subscribe: (l) => store.subscribe(l),
    destroy: () => endWatch(),
    errors: () => [...errorLog],
  }
  return engine
}
```

- [ ] **Step 4: Export from barrel** — add:

```ts
export { createSkinEngine, type SkinEngine, type SkinEngineConfig, type SkinPatch } from './engine'
```

- [ ] **Step 5: Run** — `pnpm --filter @iris-ui-kit/skins test` → PASS (all engine cases).

- [ ] **Step 6: Build + typecheck + lint the package**

Run: `pnpm --filter @iris-ui-kit/skins build && pnpm --filter @iris-ui-kit/skins typecheck && pnpm --filter @iris-ui-kit/skins lint`
Expected: dist emitted, no type/lint errors.

- [ ] **Step 7: Commit**

```bash
git add packages/skins/src/engine.ts packages/skins/src/engine.test.ts packages/skins/src/index.ts
git commit -m "feat(skins): add createSkinEngine (persist, system-follow, live-edit, catalog)"
```

---

## Task 9: Size budget + ROADMAP note (wire the package into gates)

**Files:**

- Modify: `scripts/check-size.mjs`, `ROADMAP.md`

- [ ] **Step 1: Add skins budget** — in `scripts/check-size.mjs` `BUDGETS`, add after `theme`:

```js
  skins: 4,
```

- [ ] **Step 2: Run the full build + size gate**

Run: `pnpm turbo run build && pnpm size`
Expected: `@iris-ui-kit/skins ok` within 4KB; all packages ok. If skins is genuinely larger, raise the budget deliberately in this commit.

- [ ] **Step 3: ROADMAP note** — append a short line under the status summary noting the skin system shipped (framework-agnostic `@iris-ui-kit/skins`: inheritance + custom tokens + marketplace catalog + persist/FOUC/follow-system/live-edit; React/Vue `SkinProvider`+`useSkin`). Keep the existing "唯二未交付项" (npm publish, QRCode) intact.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-size.mjs ROADMAP.md
git commit -m "build(skins): add @iris-ui-kit/skins size budget + ROADMAP note"
```

---

## Task 10: React adapter — `SkinProvider` / `useSkin`

**Files:**

- Create: `packages/react/src/skins/SkinProvider.tsx`, `useSkin.ts`, `index.ts`, `SkinProvider.test.tsx`
- Modify: `packages/react/src/index.ts`, `packages/react/package.json`, `packages/react/tsup.config.ts`

- [ ] **Step 1: Add dep + external**
  - `packages/react/package.json` dependencies: add `"@iris-ui-kit/skins": "workspace:*"`.
  - `packages/react/tsup.config.ts` `external` array: add `'@iris-ui-kit/skins'`.
  - Run `pnpm install`.

- [ ] **Step 2: Failing test** — `packages/react/src/skins/SkinProvider.test.tsx`

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { createSkinEngine, type Skin } from '@iris-ui-kit/skins'
import { SkinProvider } from './SkinProvider'
import { useSkin } from './useSkin'

const brand: Skin = { id: 'brand', extends: 'dark', tokens: { 'iris.primary': '#abc' } }

function Probe() {
  const { skin, setSkin } = useSkin()
  return (
    <button onClick={() => setSkin('brand')} data-testid="b">
      {skin.id}:{skin.theme.colors['iris.primary']}
    </button>
  )
}

describe('SkinProvider / useSkin (React)', () => {
  it('provides the current skin and switches on setSkin', () => {
    const engine = createSkinEngine({ skins: [brand], default: 'light' })
    render(
      <SkinProvider engine={engine}>
        <Probe />
      </SkinProvider>,
    )
    expect(screen.getByTestId('b').textContent).toContain('light')
    act(() => {
      screen.getByTestId('b').click()
    })
    expect(screen.getByTestId('b').textContent).toContain('brand:#abc')
  })

  it('applies skin vars to documentElement and reverts on unmount', () => {
    const engine = createSkinEngine({ skins: [brand], default: 'brand' })
    const { unmount } = render(
      <SkinProvider engine={engine}>
        <span />
      </SkinProvider>,
    )
    expect(document.documentElement.getAttribute('data-iris-skin')).toBe('brand')
    unmount()
    expect(document.documentElement.getAttribute('data-iris-skin')).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify fail.**

- [ ] **Step 4: Implement** — `packages/react/src/skins/SkinProvider.tsx`

```tsx
import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react'
import { injectGlobalStyles } from '@iris-ui-kit/theme'
import {
  applySkin,
  type ResolvedSkin,
  type SkinEngine,
  type ApplySkinResult,
} from '@iris-ui-kit/skins'
import { useStore } from '../useStore'

interface IrisSkinContextValue {
  engine: SkinEngine
  current: ResolvedSkin
}

const IrisSkinContext = createContext<IrisSkinContextValue | null>(null)

export interface SkinProviderProps {
  engine: SkinEngine
  target?: HTMLElement | null
  children?: ReactNode
}

/**
 * Renderless provider mirroring `<ThemeProvider>`: subscribes to the skin
 * engine's store, applies the resolved skin's CSS vars to `target` (or
 * `document.documentElement`), reverts on unmount. Zero skin logic — all of it
 * lives in `@iris-ui-kit/skins`. Client boundary (tsup prepends `'use client'`).
 */
export function SkinProvider({ engine, target = null, children }: SkinProviderProps) {
  const current = useStore(engine.store)
  const appliedRef = useRef<ApplySkinResult | null>(null)

  useEffect(() => {
    injectGlobalStyles()
    const el = target ?? document.documentElement
    appliedRef.current?.revert()
    appliedRef.current = applySkin(current, el)
    return () => {
      appliedRef.current?.revert()
      appliedRef.current = null
    }
  }, [current, target])

  return <IrisSkinContext.Provider value={{ engine, current }}>{children}</IrisSkinContext.Provider>
}

export function useSkinContext(): IrisSkinContextValue {
  const ctx = useContext(IrisSkinContext)
  if (!ctx) throw new Error('[iris-ui] useSkin(): no <SkinProvider> ancestor found')
  return ctx
}

/** Non-throwing read for skin-aware primitives that may render standalone. */
export function useSkinOptional(): ResolvedSkin | undefined {
  return useContext(IrisSkinContext)?.current
}
```

- [ ] **Step 5: Implement** — `packages/react/src/skins/useSkin.ts`

```ts
import type { ResolvedSkin, Skin, SkinMode, SkinPatch, SkinError } from '@iris-ui-kit/skins'
import { useSkinContext } from './SkinProvider'

export interface UseSkinReturn {
  skin: ResolvedSkin
  setSkin: (id: string) => void
  loadSkin: (source: string | Skin) => Promise<ResolvedSkin>
  useFromCatalog: (id: string) => Promise<ResolvedSkin>
  patch: (overrides: SkinPatch) => void
  resetPatch: () => void
  setMode: (mode: SkinMode) => void
  availableSkins: () => Skin[]
  errors: () => SkinError[]
}

/** Read + control the active skin from anywhere inside a `<SkinProvider>`. */
export function useSkin(): UseSkinReturn {
  const { engine, current } = useSkinContext()
  return {
    skin: current,
    setSkin: engine.setSkin,
    loadSkin: engine.loadSkin,
    useFromCatalog: engine.useFromCatalog,
    patch: engine.patch,
    resetPatch: engine.resetPatch,
    setMode: engine.setMode,
    availableSkins: engine.availableSkins,
    errors: engine.errors,
  }
}
```

- [ ] **Step 6: Implement** — `packages/react/src/skins/index.ts`

```ts
export {
  SkinProvider,
  useSkinContext,
  useSkinOptional,
  type SkinProviderProps,
} from './SkinProvider'
export { useSkin, type UseSkinReturn } from './useSkin'
```

- [ ] **Step 7: Re-export from package barrel** — append to `packages/react/src/index.ts`:

```ts
export * from './skins'
```

- [ ] **Step 8: Run** — `pnpm --filter @iris-ui-kit/react test -- skins` → PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/react/src/skins packages/react/src/index.ts packages/react/package.json packages/react/tsup.config.ts pnpm-lock.yaml
git commit -m "feat(react): add SkinProvider + useSkin adapter for @iris-ui-kit/skins"
```

---

## Task 11: Vue adapter — `SkinProvider` / `useSkin`

**Files:**

- Create: `packages/vue/src/skins/SkinProvider.ts`, `useSkin.ts`, `index.ts`, `SkinProvider.test.ts`
- Modify: `packages/vue/src/index.ts`, `packages/vue/package.json`, `packages/vue/tsup.config.ts`

- [ ] **Step 1: Add dep + external**
  - `packages/vue/package.json` dependencies: add `"@iris-ui-kit/skins": "workspace:*"`.
  - `packages/vue/tsup.config.ts` `external`: add `'@iris-ui-kit/skins'`.
  - Run `pnpm install`.

- [ ] **Step 2: Failing test** — `packages/vue/src/skins/SkinProvider.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createSkinEngine, type Skin } from '@iris-ui-kit/skins'
import { SkinProvider } from './SkinProvider'
import { useSkin } from './useSkin'

const brand: Skin = { id: 'brand', extends: 'dark', tokens: { 'iris.primary': '#abc' } }

const Probe = defineComponent({
  setup() {
    const { skin, setSkin } = useSkin()
    return () =>
      h(
        'button',
        { onClick: () => setSkin('brand'), 'data-testid': 'b' },
        `${skin.value.id}:${skin.value.theme.colors['iris.primary']}`,
      )
  },
})

describe('SkinProvider / useSkin (Vue)', () => {
  it('provides the current skin and switches on setSkin', async () => {
    const engine = createSkinEngine({ skins: [brand], default: 'light' })
    const wrapper = mount(SkinProvider, {
      props: { engine },
      slots: { default: () => h(Probe) },
    })
    expect(wrapper.get('[data-testid="b"]').text()).toContain('light')
    await wrapper.get('[data-testid="b"]').trigger('click')
    expect(wrapper.get('[data-testid="b"]').text()).toContain('brand:#abc')
  })

  it('applies skin vars to documentElement and reverts on unmount', () => {
    const engine = createSkinEngine({ skins: [brand], default: 'brand' })
    const wrapper = mount(SkinProvider, { props: { engine }, slots: { default: () => h('span') } })
    expect(document.documentElement.getAttribute('data-iris-skin')).toBe('brand')
    wrapper.unmount()
    expect(document.documentElement.getAttribute('data-iris-skin')).toBeNull()
  })
})
```

- [ ] **Step 3: Run to verify fail.**

- [ ] **Step 4: Implement** — `packages/vue/src/skins/SkinProvider.ts`

```ts
import {
  defineComponent,
  inject,
  onBeforeUnmount,
  onMounted,
  provide,
  ref,
  watch,
  type InjectionKey,
  type PropType,
  type Ref,
} from 'vue'
import { injectGlobalStyles } from '@iris-ui-kit/theme'
import {
  applySkin,
  type ApplySkinResult,
  type ResolvedSkin,
  type SkinEngine,
} from '@iris-ui-kit/skins'

export interface IrisSkinContext {
  engine: SkinEngine
  current: Ref<ResolvedSkin>
}

export const IrisSkinKey: InjectionKey<IrisSkinContext> = Symbol('IrisSkin')

/** Renderless provider mirroring `<IrisThemeProvider>` for skins. */
export const SkinProvider = defineComponent({
  name: 'IrisSkinProvider',
  props: {
    engine: { type: Object as PropType<SkinEngine>, required: true },
    target: { type: Object as PropType<HTMLElement | null>, default: null },
  },
  setup(props, { slots }) {
    const current = ref(props.engine.current()) as Ref<ResolvedSkin>
    const unsubscribe = props.engine.subscribe((next) => {
      current.value = next
    })

    let applied: ApplySkinResult | null = null
    const targetEl = () => props.target ?? document.documentElement
    const apply = () => {
      applied?.revert()
      applied = applySkin(current.value, targetEl())
    }

    onMounted(() => {
      injectGlobalStyles()
      apply()
    })
    watch(current, () => {
      if (applied) apply()
    })
    onBeforeUnmount(() => {
      unsubscribe()
      applied?.revert()
      applied = null
    })

    provide(IrisSkinKey, { engine: props.engine, current })
    return () => slots.default?.()
  },
})

export function useSkinContext(): IrisSkinContext {
  const ctx = inject(IrisSkinKey)
  if (!ctx) throw new Error('[iris-ui] useSkin(): no <SkinProvider> ancestor found')
  return ctx
}
```

- [ ] **Step 5: Implement** — `packages/vue/src/skins/useSkin.ts`

```ts
import type { ComputedRef } from 'vue'
import { computed } from 'vue'
import type { ResolvedSkin, Skin, SkinMode, SkinPatch, SkinError } from '@iris-ui-kit/skins'
import { useSkinContext } from './SkinProvider'

export interface UseSkinReturn {
  skin: ComputedRef<ResolvedSkin>
  setSkin: (id: string) => void
  loadSkin: (source: string | Skin) => Promise<ResolvedSkin>
  useFromCatalog: (id: string) => Promise<ResolvedSkin>
  patch: (overrides: SkinPatch) => void
  resetPatch: () => void
  setMode: (mode: SkinMode) => void
  availableSkins: () => Skin[]
  errors: () => SkinError[]
}

/** Read + control the active skin from anywhere inside a `<SkinProvider>`. */
export function useSkin(): UseSkinReturn {
  const { engine, current } = useSkinContext()
  return {
    skin: computed(() => current.value),
    setSkin: engine.setSkin,
    loadSkin: engine.loadSkin,
    useFromCatalog: engine.useFromCatalog,
    patch: engine.patch,
    resetPatch: engine.resetPatch,
    setMode: engine.setMode,
    availableSkins: engine.availableSkins,
    errors: engine.errors,
  }
}
```

- [ ] **Step 6: Implement** — `packages/vue/src/skins/index.ts`

```ts
export { SkinProvider, IrisSkinKey, useSkinContext, type IrisSkinContext } from './SkinProvider'
export { useSkin, type UseSkinReturn } from './useSkin'
```

- [ ] **Step 7: Re-export from package barrel** — append to `packages/vue/src/index.ts`:

```ts
export * from './skins'
```

- [ ] **Step 8: Run** — `pnpm --filter @iris-ui-kit/vue test -- skins` → PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/vue/src/skins packages/vue/src/index.ts packages/vue/package.json packages/vue/tsup.config.ts pnpm-lock.yaml
git commit -m "feat(vue): add SkinProvider + useSkin adapter for @iris-ui-kit/skins"
```

---

## Task 12: Full gate sweep + final commit

- [ ] **Step 1: Run every gate**

```bash
pnpm turbo run test typecheck lint build
pnpm size
pnpm check:rsc
pnpm format:check
```

Expected: all green. `check:rsc` confirms the React skins entry carries `'use client'` (auto-injected by tsup `onSuccess`). If `format:check` flags files, run `pnpm exec prettier --write` on them and re-stage.

- [ ] **Step 2: If any formatting fixups were needed, commit them**

```bash
git add -A
git commit -m "style(skins): prettier formatting"
```

- [ ] **Step 3: Confirm clean tree** — `git status` → clean.

---

## Self-Review (completed during planning)

**Spec coverage check:**

- §3 data model (Skin/ResolvedSkin/Manifest) → Task 2 (types), Task 4 (resolve), Task 7 (catalog). ✓
- §5.1 validateSkin → Task 3. §5.2 resolveSkin → Task 4. §5.3 registry → Task 4. ✓
- §5.4 applyCssVars refactor → Task 1. §5.5 applySkin → Task 6. ✓
- §5.6 renderSkinStyle, §5.7 bootScript, §5.8 storage → Task 5. ✓
- §5.9 loadSkin, §5.10 catalog → Task 7. §5.11 engine → Task 8. ✓
- §6 React adapter → Task 10. Vue adapter → Task 11. ✓
- §7 error model → Task 2 (errors.ts), used throughout. ✓
- §9 build/packaging/size → Task 2 (config) + Task 9 (size budget). ✓
- §11 verification gates → Task 12. ✓
- Builtins (base light/dark skins) → Task 4. ✓
- Runtime: persist (Task 8 storage), FOUC (Task 5 bootScript), follow-system (Task 8 mode), live-edit (Task 8 patch). ✓

**Type consistency check:** `SkinEngine` surface (setSkin/loadSkin/useFromCatalog/patch/resetPatch/setMode/subscribe/registry/errors) is identical across engine.ts (Task 8), React useSkin (Task 10), Vue useSkin (Task 11). `ApplySkinResult`, `ResolvedSkin`, `Skin`, `SkinPatch`, `SkinError` names consistent. `applyCssVars` signature `(entries, target)` consistent between Task 1 definition and Task 6 use. Built-in ids `'light'`/`'dark'` consistent between Task 4 builtins and engine fallback (Task 8).

**Placeholder scan:** none — every code step contains complete content.

**Known follow-ups (not blocking):** playground demos + `@iris-ui-kit/manifest` skin surface were considered (spec §9/§12 step 10) but deferred as non-essential to a working, tested library; they can be a later enhancement. The library is fully functional and gated without them.
