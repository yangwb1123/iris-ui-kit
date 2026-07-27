import { createCmsNavigation } from '@iris-ui-kit/cms-shared'
import type { NavNode } from '@iris-ui-kit/solid'

/**
 * Shared nav contract using the compact Vue/Solid variant. The shell applies
 * role filtering at runtime.
 */
export const menus: NavNode[] = createCmsNavigation()
