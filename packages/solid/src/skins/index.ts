// Re-export the framework-agnostic skin engine, catalog, storage, builtins, and
// types so consumers get the whole skin system from `@iris-ui-kit/solid`. Explicit
// named re-exports (not `export *`) so they survive tree-shaking of the external
// `@iris-ui-kit/skins` package.
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
} from '@iris-ui-kit/skins'
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
} from '@iris-ui-kit/skins'

export {
  SkinProvider,
  useSkinContext,
  useSkinOptional,
  type SkinProviderProps,
} from './SkinProvider'
export { useSkin, type UseSkinReturn } from './useSkin'
