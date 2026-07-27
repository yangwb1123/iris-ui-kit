export { default as IrisAdminLayout } from './AdminLayout.svelte'
export { default as IrisNavMenu } from './NavMenu.svelte'
export { default as IrisAdminBreadcrumb } from './AdminBreadcrumb.svelte'
export { default as IrisAdminTabs } from './AdminTabs.svelte'
export { useTabsNav, type UseTabsNavReturn } from './useTabsNav'
export { useAdminPreferences, type UseAdminPreferencesReturn } from './useAdminPreferences'
export {
  useAdminShell,
  type UseAdminShellConfig,
  type UseAdminShellReturn,
} from './useAdminShell.svelte'
export type {
  IrisAdminLayoutProps,
  IrisAdminLayoutMode,
  IrisAdminMenuAlign,
  IrisAdminContentWidth,
  IrisAdminContentHeight,
  IrisNavMenuProps,
  IrisAdminBreadcrumbProps,
  IrisAdminTabsProps,
} from './types'

// Re-export the framework-agnostic nav model so consumers get the admin surface
// from one import (mirror the Solid adapter).
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
