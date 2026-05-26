export type { IrisIcon, IrisIconNode, IrisIconSet, IrisIconResolver } from './types'
export { defaultIcons } from './icons'
export {
  createIconRegistry,
  defaultIconRegistry,
  resolveIcon,
  type IrisIconRegistry,
  type CreateIconRegistryOptions,
} from './registry'
export { renderIconSvg, type RenderIconOptions } from './render'
export { resolveThemedIcon, type ThemeIconConfig } from './theme'
