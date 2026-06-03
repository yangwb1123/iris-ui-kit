import type { NavNode } from '@iris-ui/vue'

/**
 * The single nav-tree config that drives the whole shell: the sidebar menu, the
 * header breadcrumb, and (through the host) the open tabs. Icons are names from
 * the built-in Iris icon registry.
 */
export const menus: NavNode[] = [
  { key: 'dashboard', title: 'Dashboard', icon: 'menu', order: 1 },
  {
    key: 'content',
    title: 'Content',
    icon: 'folder',
    order: 2,
    children: [
      { key: 'articles', title: 'Articles', icon: 'file', badge: 'new' },
      { key: 'categories', title: 'Categories', icon: 'folder' },
      { key: 'media', title: 'Media library', icon: 'upload' },
    ],
  },
  {
    key: 'users',
    title: 'Users',
    icon: 'more-horizontal',
    order: 3,
    children: [
      { key: 'all-users', title: 'All users', icon: 'eye' },
      { key: 'roles', title: 'Roles & access', icon: 'check-circle' },
    ],
  },
  {
    key: 'analytics',
    title: 'Analytics',
    icon: 'search',
    order: 4,
    children: [
      { key: 'overview', title: 'Overview', icon: 'clock' },
      { key: 'reports', title: 'Reports', icon: 'file' },
    ],
  },
  { key: 'calendar', title: 'Calendar', icon: 'calendar', order: 5 },
  { key: 'settings', title: 'Settings', icon: 'info', order: 6 },
]
