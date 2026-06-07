import { createTabsNav } from '@iris-ui/svelte'

/** Shared multi-tab store; Dashboard is a pinned (non-closable) affix tab. */
export const tabsNav = createTabsNav({
  tabs: [{ key: 'dashboard', title: 'Dashboard', icon: 'menu', pinned: true }],
  activeKey: 'dashboard',
})
