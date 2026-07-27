export {
  IrisAdminLayout,
  type IrisAdminLayoutProps,
  type IrisAdminLayoutMode,
  type IrisAdminMenuAlign,
  type IrisAdminContentWidth,
  type IrisAdminContentHeight,
} from './AdminLayout'
export { IrisNavMenu, type IrisNavMenuProps } from './NavMenu'
export { IrisAdminBreadcrumb, type IrisAdminBreadcrumbProps } from './AdminBreadcrumb'
export { IrisAdminTabs, type IrisAdminTabsProps } from './AdminTabs'
export { useTabsNav, type UseTabsNavReturn } from './useTabsNav'
export { useAdminPreferences, type UseAdminPreferencesReturn } from './useAdminPreferences'
export { useAdminShell, type UseAdminShellConfig, type UseAdminShellReturn } from './useAdminShell'

// Re-export the framework-agnostic nav model so consumers get the admin surface
// from one import. Explicit names (not `export *`) so tsup keeps them.
export {
  createTabsNav,
  createAdminPreferences,
  localStorageAdminPreferencesStorage,
  isClosable,
  isBranch,
  visibleNav,
  flattenNav,
  findNavNode,
  findNavPath,
  firstLeaf,
  filterNavByAccess,
  nodeAllowsRoles,
  type NavNode,
  type TabItem,
  type TabsNav,
  type TabsNavState,
  type TabsNavConfig,
  type AdminPreferences,
  type AdminPreferencesState,
} from '@iris-ui-kit/core'
