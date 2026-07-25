import type { NavNode } from '@iris-ui/react'

/**
 * The single nav-tree config that drives the whole shell: the sidebar menu, the
 * header breadcrumb, and (through the host) the open tabs. Icons are names from
 * the built-in Iris icon registry.
 *
 * RBAC: nodes carry an optional `roles`. A node with no `roles` is visible to
 * everyone; the Admin group (and "Roles & access") are gated to `admin`, so a
 * viewer session sees a smaller menu — the shell filters this tree through
 * `filterNavByAccess(menus, [session.role])`.
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
      { key: 'roles', title: 'Roles & access', icon: 'check-circle', roles: ['admin'] },
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
  { key: 'form-builder', title: 'Form builder', icon: 'edit', order: 6 },
  { key: 'realtime', title: 'Realtime', icon: 'clock', order: 7 },
  { key: 'pro-table', title: 'Pro Table', icon: 'table', order: 8 },
  { key: 'documentation', title: 'Documentation', icon: 'file', order: 9 },
  // Admin-only section: viewers won't see this at all.
  {
    key: 'admin',
    title: 'Admin',
    icon: 'info',
    order: 10,
    roles: ['admin'],
    children: [
      { key: 'settings', title: 'Settings', icon: 'info' },
      { key: 'audit-log', title: 'Audit log', icon: 'clock' },
    ],
  },
]
