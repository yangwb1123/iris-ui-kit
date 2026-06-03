export { IrisNavMenu } from './NavMenu'
export { useTabsNav, type UseTabsNavReturn } from './useTabsNav'

// Re-export the framework-agnostic nav model so consumers get the whole admin
// surface from one import. Explicit names (not `export *`) so tsup keeps them.
export {
  createTabsNav,
  isBranch,
  visibleNav,
  flattenNav,
  findNavNode,
  findNavPath,
  firstLeaf,
  type NavNode,
  type TabItem,
  type TabsNav,
  type TabsNavState,
  type TabsNavConfig,
} from '@iris-ui/core'
