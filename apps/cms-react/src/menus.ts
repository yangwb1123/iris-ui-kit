import { createCmsNavigation } from '@iris-ui-kit/cms-shared'
import type { NavNode } from '@iris-ui-kit/react'

/**
 * Shared workspace navigation plus React's dedicated plugin and realtime
 * showcases. The shell applies role filtering at runtime.
 */
export const menus: NavNode[] = [
  ...createCmsNavigation({ auditLog: true }),
  { key: 'form-builder', title: 'Form builder', icon: 'edit', order: 7 },
  { key: 'realtime', title: 'Realtime', icon: 'clock', order: 8 },
  { key: 'pro-table', title: 'Pro Table', icon: 'table', order: 9 },
  { key: 'documentation', title: 'Documentation', icon: 'file', order: 10 },
]
