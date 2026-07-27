import { createCmsNavigation } from '@iris-ui-kit/cms-shared'
import type { NavNode } from '@iris-ui-kit/svelte'

/**
 * Shared workspace navigation plus the schema-driven form-builder showcase.
 * The shell applies role filtering at runtime.
 */
export const menus: NavNode[] = [
  ...createCmsNavigation({ auditLog: true }),
  { key: 'form-builder', title: 'Form builder', icon: 'edit', order: 7 },
]
