// Re-export the framework-agnostic skin engine, catalog, storage, builtins, and
// types so consumers get the whole skin system from `@iris-ui/svelte`. Explicit
// named re-exports (not `export *`) so they survive tree-shaking of the external
// `@iris-ui/skins` package.
export {
  createSkinEngine,
  createSkinRegistry,
  createSkinCatalog,
  loadSkin,
  applySkin,
  renderSkinStyle,
  skinToCssEntries,
  skinBootScript,
  localStorageSkinStorage,
  memorySkinStorage,
  validateSkin,
  resolveSkin,
  lightSkin,
  darkSkin,
  builtinSkins,
  skinError,
  SkinResolutionError,
} from '@iris-ui/skins'
export type {
  Skin,
  ResolvedSkin,
  SkinTokenOverrides,
  SkinManifest,
  SkinManifestEntry,
  SkinMode,
  SkinStorage,
  SkinError,
  SkinErrorCode,
  SkinEngine,
  SkinEngineConfig,
  SkinPatch,
  SkinCatalog,
  SkinCatalogConfig,
  SkinRegistry,
  SkinLookup,
  LoadSkinOptions,
  ApplySkinResult,
  SkinBootScriptConfig,
} from '@iris-ui/skins'

export { default as SkinProvider } from './SkinProvider.svelte'
export { useSkin, useSkinContext, useSkinOptional, type UseSkinReturn } from './useSkin'
export type { SkinProviderProps, IrisSkinContextValue } from './context'
