export type { IrisIcon, IrisIconNode, IrisIconSet, IrisIconResolver } from './types'
export { defaultIcons } from './default-icons'
// Per-icon, individually tree-shakeable exports (`import { chevronDown }`).
// `sideEffects: false` + per-icon consts that reference only their own data let
// a bundler drop every icon the consumer doesn't import. Build a minimal
// registry from them via `createIconRegistry({ icons: [chevronDown, search] })`.
// Re-exporting the source barrel prevents a hand-maintained allowlist from
// silently hiding newly-added icons from the package's public API.
export * from './icons'
export {
  createIconRegistry,
  defaultIconRegistry,
  resolveIcon,
  type IrisIconRegistry,
  type CreateIconRegistryOptions,
} from './registry'
export { renderIconSvg, type RenderIconOptions } from './render'
export { resolveThemedIcon, type ThemeIconConfig } from './theme'
