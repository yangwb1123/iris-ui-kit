export { IrisAdminLayout, type IrisAdminLayoutMode } from './AdminLayout'
export { IrisNavMenu } from './NavMenu'
export { IrisAdminBreadcrumb } from './AdminBreadcrumb'
export { IrisAdminTabs } from './AdminTabs'
export { useTabsNav, type UseTabsNavReturn } from './useTabsNav'
export { useAdminShell, type UseAdminShellConfig, type UseAdminShellReturn } from './useAdminShell'

// Re-export the framework-agnostic nav model so consumers get the whole admin
// surface from one import. Explicit names (not `export *`) so tsup keeps them.
export {
  createTabsNav,
  isClosable,
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
