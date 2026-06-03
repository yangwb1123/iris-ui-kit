/**
 * Framework-agnostic navigation-tree model + pure selectors for admin layouts.
 *
 * One normalized `NavNode[]` tree drives the side/header menu, the breadcrumb
 * trail, and (via the host) the open-tabs set — mirroring how Vben derives every
 * nav region from a single route/menu config. These are pure functions: no
 * store, no framework, no router. The host maps its router → `NavNode[]` and
 * computes the active key; the selectors here turn that into menu/breadcrumb
 * shapes.
 */

export interface NavNode {
  /** Stable unique key (route name / path). */
  key: string
  /** Display label. */
  title: string
  /** Optional icon name, resolved by the host's icon registry. */
  icon?: string
  /** Optional path / href; routing is host-owned. */
  path?: string
  /** Optional badge text or count shown on the menu item. */
  badge?: string | number
  /** Disable interaction. */
  disabled?: boolean
  /** Hide from the rendered menu (kept in the tree for path/breadcrumb lookups). */
  hidden?: boolean
  /** Sort order among siblings (ascending; missing sorts last, stably). */
  order?: number
  /** Child nodes — the node is a branch (group / submenu) when this is non-empty. */
  children?: NavNode[]
}

/** A node is a branch (group / submenu) when it has at least one child. */
export function isBranch(node: NavNode): boolean {
  return Array.isArray(node.children) && node.children.length > 0
}

function byOrder(a: NavNode, b: NavNode): number {
  return (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY)
}

/**
 * A render-ready copy of the tree: `hidden` nodes dropped and each level sorted
 * by `order` (stable for equal/absent orders). Recurses into children.
 */
export function visibleNav(nodes: NavNode[]): NavNode[] {
  return nodes
    .filter((n) => !n.hidden)
    .map((n) => (n.children ? { ...n, children: visibleNav(n.children) } : n))
    .sort(byOrder)
}

/** Depth-first flatten of every node (parents before their children). */
export function flattenNav(nodes: NavNode[]): NavNode[] {
  const out: NavNode[] = []
  const walk = (list: NavNode[]): void => {
    for (const n of list) {
      out.push(n)
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return out
}

/** Find a node by key (depth-first), or `undefined`. */
export function findNavNode(nodes: NavNode[], key: string): NavNode | undefined {
  return flattenNav(nodes).find((n) => n.key === key)
}

/**
 * The ancestor→node chain for `key` (root first, the node itself last), or `[]`
 * when not found. Feeds the breadcrumb trail and the set of expanded menu keys.
 */
export function findNavPath(nodes: NavNode[], key: string): NavNode[] {
  const path: NavNode[] = []
  const walk = (list: NavNode[]): boolean => {
    for (const n of list) {
      path.push(n)
      if (n.key === key) return true
      if (n.children && walk(n.children)) return true
      path.pop()
    }
    return false
  }
  walk(nodes)
  return path
}

/**
 * The first leaf reachable from `node` (depth-first), or `node` itself when it
 * is already a leaf. Used to redirect a branch click to its first real page.
 */
export function firstLeaf(node: NavNode): NavNode {
  let current = node
  while (current.children && current.children.length > 0) current = current.children[0]!
  return current
}
