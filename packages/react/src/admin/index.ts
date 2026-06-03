export { IrisAdminLayout, type IrisAdminLayoutProps, type IrisAdminLayoutMode } from './AdminLayout'
export { IrisNavMenu, type IrisNavMenuProps } from './NavMenu'
export { IrisAdminBreadcrumb, type IrisAdminBreadcrumbProps } from './AdminBreadcrumb'
export { IrisAdminTabs, type IrisAdminTabsProps } from './AdminTabs'
export { useTabsNav, type UseTabsNavReturn } from './useTabsNav'

// Re-export the framework-agnostic nav model so consumers get the whole admin
// surface from one import. Explicit names (not `export *`) so tsup keeps them.
export {
  createTabsNav,
  isClosable,
  visibleNav,
  flattenNav,
  findNavNode,
  findNavPath,
  firstLeaf,
  isBranch,
  type NavNode,
  type TabItem,
  type TabsNav,
  type TabsNavState,
  type TabsNavConfig,
} from '@iris-ui/core'
