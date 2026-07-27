import { createCmsNavigation } from '@iris-ui-kit/cms-shared'
import type { NavNode } from '@iris-ui-kit/svelte'

/**
 * Shared nav contract with the extended, grouped Admin section used by the
 * React and Svelte demos. The shell applies role filtering at runtime.
 */
export const menus: NavNode[] = createCmsNavigation({ auditLog: true })
