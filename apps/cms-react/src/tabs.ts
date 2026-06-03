import { createTabsNav } from '@iris-ui/react'

/**
 * The shared multi-tab store. The Dashboard is seeded as a pinned (non-closable)
 * affix tab, matching Vben's "home tab always open" convention.
 */
export const tabsNav = createTabsNav({
  tabs: [{ key: 'dashboard', title: 'Dashboard', icon: 'menu', pinned: true }],
  activeKey: 'dashboard',
})
