export type { IrisIcon, IrisIconNode, IrisIconSet, IrisIconResolver } from './types'
export { defaultIcons } from './icons'
// Per-icon, individually tree-shakeable exports (`import { chevronDown }`).
// `sideEffects: false` + per-icon consts that reference only their own data let
// a bundler drop every icon the consumer doesn't import. Build a minimal
// registry from them via `createIconRegistry({ icons: [chevronDown, search] })`.
export {
  // Navigation
  chevronDown,
  chevronUp,
  chevronLeft,
  chevronRight,
  chevronsUp,
  chevronsDown,
  chevronsLeft,
  chevronsRight,
  arrowUp,
  arrowDown,
  arrowLeft,
  arrowRight,
  home,
  menu,
  moreHorizontal,
  moreVertical,
  sidebar,
  externalLink,
  // Actions
  check,
  x,
  close,
  plus,
  minus,
  edit,
  copy,
  save,
  trash,
  share,
  refresh,
  filter,
  download,
  upload,
  loader,
  sortAsc,
  sortDesc,
  // Alerts
  alertTriangle,
  alertCircle,
  checkCircle,
  info,
  helpCircle,
  slash,
  // Communication
  bell,
  bellOff,
  mail,
  send,
  inbox,
  // Files
  file,
  folder,
  image,
  camera,
  paperclip,
  printer,
  // Objects
  tag,
  gift,
  calendar,
  clock,
  search,
  // Users
  user,
  users,
  // UI
  settings,
  logOut,
  logIn,
  phone,
  globe,
  mapPin,
  lock,
  unlock,
  shield,
  shieldOff,
  bookmark,
  star,
  heart,
  thumbsUp,
  thumbsDown,
  maximize,
  minimize,
  grid,
  list,
  // Theme
  sun,
  moon,
  eye,
  eyeOff,
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
