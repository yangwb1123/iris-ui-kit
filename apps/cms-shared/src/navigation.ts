import type { NavNode } from '@iris-ui-kit/core'
import { isCmsWorkspaceRoute } from './workspace-controller'
import type { CmsWorkspaceRoute } from './workspace-types'

export type CmsPageRoute = 'dashboard' | 'all-users' | 'settings' | CmsWorkspaceRoute

export interface CmsNavigationOptions {
  auditLog?: boolean
}

/**
 * The shared CMS navigation contract. React/Svelte opt into the extended
 * grouped Admin section; Vue/Solid retain their smaller, flat Settings menu.
 */
export function createCmsNavigation(options: CmsNavigationOptions = {}): NavNode[] {
  const navigation: NavNode[] = [
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
  ]

  if (options.auditLog) {
    navigation.push({
      key: 'admin',
      title: 'Admin',
      icon: 'info',
      order: 6,
      roles: ['admin'],
      children: [
        { key: 'settings', title: 'Settings', icon: 'info' },
        { key: 'audit-log', title: 'Audit log', icon: 'clock' },
      ],
    })
  } else {
    navigation.push({
      key: 'settings',
      title: 'Settings',
      icon: 'info',
      order: 6,
      roles: ['admin'],
    })
  }
  return navigation
}

export function collectCmsLeafKeys(nodes: readonly NavNode[]): string[] {
  const keys: string[] = []
  const walk = (items: readonly NavNode[]): void => {
    for (const item of items) {
      if (item.children?.length) walk(item.children)
      else keys.push(item.key)
    }
  }
  walk(nodes)
  return keys
}

export function isCmsPageRoute(value: string): value is CmsPageRoute {
  return (
    value === 'dashboard' ||
    value === 'all-users' ||
    value === 'settings' ||
    isCmsWorkspaceRoute(value)
  )
}
