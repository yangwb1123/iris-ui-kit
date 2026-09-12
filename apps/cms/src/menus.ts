import { createCmsNavigation } from '@iris-ui-kit/cms-shared'
import type { NavNode } from '@iris-ui-kit/vue'

/**
 * Shared workspace navigation plus dedicated component showcase pages.
 * The shell applies role filtering at runtime.
 */
export const menus: NavNode[] = [
  ...createCmsNavigation(),
  { key: 'form-builder', title: 'Form builder', icon: 'edit', order: 7 },
  { key: 'vxe-example', title: 'VxeGrid Example', icon: 'table', order: 8 },
  { key: 'transfer', title: 'Transfer', icon: 'shield', order: 9 },
  { key: 'tree-example', title: 'Tree Example', icon: 'check-circle', order: 10 },
  { key: 'notifications', title: 'Notifications', icon: 'bell', order: 11 },
  { key: 'copy-button', title: 'Copy Button', icon: 'copy', order: 12 },
]
