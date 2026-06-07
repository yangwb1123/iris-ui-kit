export { default as IrisAdminLayout } from './AdminLayout.svelte'
export { default as IrisNavMenu } from './NavMenu.svelte'
export { default as IrisAdminBreadcrumb } from './AdminBreadcrumb.svelte'
export { default as IrisAdminTabs } from './AdminTabs.svelte'
export { useTabsNav, type UseTabsNavReturn } from './useTabsNav'
export type {
  IrisAdminLayoutProps,
  IrisAdminLayoutMode,
  IrisNavMenuProps,
  IrisAdminBreadcrumbProps,
  IrisAdminTabsProps,
} from './types'

// Re-export the framework-agnostic nav model so consumers get the admin surface
// from one import (mirror the Solid adapter).
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
