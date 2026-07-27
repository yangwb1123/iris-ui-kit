import {
  createSkinEngine,
  createSkinCatalog,
  localStorageSkinStorage,
  type Skin,
  type SkinManifest,
} from '@iris-ui-kit/react'

export const STORAGE_KEY = 'iris-playground-skin'

/**
 * Preset skins — each built *through tokens*: a partial set of overrides on top
 * of a built-in base (`extends`), plus custom token namespaces beyond the closed
 * 21 (`brand.*`) that the showcase visualizes.
 */
export const ocean: Skin = {
  id: 'ocean',
  name: 'Ocean',
  extends: 'dark',
  tokens: {
    'iris.background': '#0b1f33',
    'iris.surface': '#0f2c4a',
    'iris.surface.hover': '#143a61',
    'iris.border': '#1d4e7e',
    'iris.foreground': '#e6f1fb',
    'iris.muted': '#7fa8cc',
    'iris.primary': '#38bdf8',
    'iris.primary.foreground': '#04222f',
    'iris.accent': '#22d3ee',
  },
  custom: {
    'brand.gradient': 'linear-gradient(135deg, #38bdf8, #6366f1)',
    'brand.shadow': '0 8px 24px rgba(56, 189, 248, 0.25)',
  },
  meta: { author: 'Iris', tags: ['blue', 'dark'] },
}

export const sunrise: Skin = {
  id: 'sunrise',
  name: 'Sunrise',
  extends: 'light',
  tokens: {
    'iris.background': '#fff7ed',
    'iris.surface': '#ffffff',
    'iris.surface.hover': '#ffedd5',
    'iris.border': '#fed7aa',
    'iris.foreground': '#431407',
    'iris.muted': '#b45309',
    'iris.primary': '#f97316',
    'iris.primary.foreground': '#fff7ed',
    'iris.accent': '#f43f5e',
  },
  custom: {
    'brand.gradient': 'linear-gradient(135deg, #fb923c, #f43f5e)',
    'brand.shadow': '0 8px 24px rgba(249, 115, 22, 0.25)',
  },
  meta: { author: 'Iris', tags: ['warm', 'light'] },
}

export const forest: Skin = {
  id: 'forest',
  name: 'Forest',
  extends: 'dark',
  tokens: {
    'iris.background': '#0c1f15',
    'iris.surface': '#12301f',
    'iris.surface.hover': '#1a4129',
    'iris.border': '#225235',
    'iris.foreground': '#e7f5ec',
    'iris.muted': '#86bfa0',
    'iris.primary': '#34d399',
    'iris.primary.foreground': '#04241a',
    'iris.accent': '#a3e635',
  },
  custom: {
    'brand.gradient': 'linear-gradient(135deg, #34d399, #a3e635)',
    'brand.shadow': '0 8px 24px rgba(52, 211, 153, 0.25)',
  },
  meta: { author: 'Iris', tags: ['green', 'dark'] },
}

/** A skin with light/dark companions, used by the "Follow system" demo. */
export const auto: Skin = {
  id: 'auto',
  name: 'Auto (system)',
  extends: 'light',
  variants: { light: 'sunrise', dark: 'ocean' },
}

export const presetSkins: Skin[] = [ocean, sunrise, forest, auto]

/**
 * A marketplace catalog with NO server: an in-memory manifest + skin documents
 * served through an injected `fetch`. Exercises the real catalog SDK code path
 * (load → list → lazy fetch by id → validate) end-to-end in the browser.
 */
const catalogSkins: Record<string, Skin> = {
  grape: {
    id: 'grape',
    name: 'Grape',
    extends: 'dark',
    tokens: {
      'iris.background': '#1a1030',
      'iris.surface': '#251748',
      'iris.surface.hover': '#321f5f',
      'iris.border': '#422d77',
      'iris.foreground': '#ede9fe',
      'iris.muted': '#a78bfa',
      'iris.primary': '#a855f7',
      'iris.primary.foreground': '#1a1030',
      'iris.accent': '#ec4899',
    },
    custom: {
      'brand.gradient': 'linear-gradient(135deg, #a855f7, #ec4899)',
      'brand.shadow': '0 8px 24px rgba(168, 85, 247, 0.3)',
    },
    meta: { author: 'Community', tags: ['purple', 'dark'] },
  },
  sand: {
    id: 'sand',
    name: 'Sand',
    extends: 'light',
    tokens: {
      'iris.background': '#faf7f2',
      'iris.surface': '#ffffff',
      'iris.surface.hover': '#f1e9dc',
      'iris.border': '#e2d5c0',
      'iris.foreground': '#3f3527',
      'iris.muted': '#9c8a6e',
      'iris.primary': '#b08968',
      'iris.primary.foreground': '#fffaf3',
      'iris.accent': '#7f9172',
    },
    custom: {
      'brand.gradient': 'linear-gradient(135deg, #d6bd98, #b08968)',
      'brand.shadow': '0 8px 24px rgba(176, 137, 104, 0.25)',
    },
    meta: { author: 'Community', tags: ['neutral', 'light'] },
  },
}

const manifest: SkinManifest = {
  schema: 1,
  skins: [
    { id: 'grape', name: 'Grape', url: 'grape.json', meta: { tags: ['purple'] } },
    { id: 'sand', name: 'Sand', url: 'sand.json', meta: { tags: ['neutral'] } },
  ],
}

const demoFetch: typeof fetch = async (input) => {
  const file = String(input).split('/').pop() ?? ''
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  if (file === 'manifest.json') return json(manifest)
  const id = file.replace(/\.json$/, '')
  const skin = catalogSkins[id]
  return skin ? json(skin) : json({ error: 'not found' }, 404)
}

export const demoCatalog = createSkinCatalog({
  manifestUrl: 'https://demo.iris-ui.dev/skins/manifest.json',
  fetch: demoFetch,
})

/** The single engine instance: presets + persistence + the marketplace catalog. */
export const skinEngine = createSkinEngine({
  skins: presetSkins,
  default: 'light',
  storage: localStorageSkinStorage(STORAGE_KEY),
  catalog: demoCatalog,
})

/** Prefilled sample for the "load from JSON" demo. */
export const sampleSkinJson = JSON.stringify(
  {
    id: 'midnight',
    name: 'Midnight',
    extends: 'dark',
    tokens: { 'iris.primary': '#818cf8', 'iris.background': '#0a0a12' },
    custom: {
      'brand.gradient': 'linear-gradient(135deg, #818cf8, #22d3ee)',
      'brand.shadow': '0 8px 24px rgba(129, 140, 248, 0.3)',
    },
  },
  null,
  2,
)
