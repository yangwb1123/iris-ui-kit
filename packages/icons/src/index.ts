export type { IrisIcon, IrisIconNode, IrisIconSet, IrisIconResolver } from './types'
export { defaultIcons } from './icons'
// Per-icon, individually tree-shakeable exports (`import { chevronDown }`).
// `sideEffects: false` + per-icon consts that reference only their own data let
// a bundler drop every icon the consumer doesn't import. Build a minimal
// registry from them via `createIconRegistry({ icons: [chevronDown, search] })`.
export {
  chevronDown,
  chevronUp,
  chevronLeft,
  chevronRight,
  check,
  x,
  search,
  plus,
  minus,
  calendar,
  clock,
  info,
  alertTriangle,
  alertCircle,
  checkCircle,
  menu,
  moreHorizontal,
  eye,
  eyeOff,
  upload,
  folder,
  file,
  sun,
  moon,
} from './icons'
export {
  createIconRegistry,
  defaultIconRegistry,
  resolveIcon,
  type IrisIconRegistry,
  type CreateIconRegistryOptions,
} from './registry'
export { renderIconSvg, type RenderIconOptions } from './render'
export { resolveThemedIcon, type ThemeIconConfig } from './theme'
